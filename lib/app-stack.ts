import * as cdk from '@aws-cdk/core';
import * as dynamodb  from  '@aws-cdk/aws-dynamodb';
import * as lambda from '@aws-cdk/aws-lambda';
import * as sqs from '@aws-cdk/aws-sqs';
import * as apigateway from '@aws-cdk/aws-apigateway'; 
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as route53 from '@aws-cdk/aws-route53';
import * as targets from '@aws-cdk/aws-route53-targets';
import * as iam from '@aws-cdk/aws-iam';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoEventSource, SqsDlq } from '@aws-cdk/aws-lambda-event-sources';

interface  CustomAppStackProps  extends  cdk.StackProps  {
  readonly globalTablePrimaryKeyName: string;
  readonly globalTableName: string;
  readonly env: any;
  readonly domainName: string;
  readonly subDomainName: string;
  readonly certificate: acm.ICertificate;
}

export class AppStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: CustomAppStackProps) {
    super(scope, id, props);

    const regionalPrimaryKeyName = 'apiKey';

    const client = new DynamoDB({  region: props.env.region  });

    // Query the regions table
    let globalTableInfoRequest = async() => await client.describeTable({ TableName: props.globalTableName });
    
    globalTableInfoRequest().then(  globalTableInfoResult  =>  {

      // DynamoDB

      const globalTable = dynamodb.Table.fromTableAttributes(this, "globalTable", {
        tableArn: globalTableInfoResult?.Table?.TableArn,
        tableStreamArn: globalTableInfoResult?.Table?.LatestStreamArn
      });

      const regionApiKeyTable = new dynamodb.Table(this, "regionApiKeyTable", {
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        partitionKey: { name: regionalPrimaryKeyName, type: dynamodb.AttributeType.STRING },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });      

      // API
      const api = new apigateway.RestApi(this, 'restApi', {
        restApiName: 'API Gateway',
      });

      // Custom Domain
      const restApiCustomDomain = new apigateway.DomainName(this, 'restApiCustomDomain', {
         domainName: props.subDomainName.concat(props.domainName),
         certificate: props.certificate
      });

      restApiCustomDomain.addBasePathMapping(api);

      // API Lambdas
      const getLambda = new lambda.Function(this, 'getLambda', {
        code: new lambda.AssetCode('src'),
        handler: 'src/get.handler',
        runtime: lambda.Runtime.NODEJS_10_X
      });

      const createLambda = new lambda.Function(this, 'createLambda', {
        code: new lambda.AssetCode('src'),
        handler: 'src/create.handler',
        runtime: lambda.Runtime.NODEJS_10_X,
        environment: {
          TABLE_NAME: props.globalTableName,
          PRIMARY_KEY: props.globalTablePrimaryKeyName
        }
      });

      globalTable.grantWriteData(createLambda);

      // API Calls
      const examples = api.root.addResource('examples');
      const getIntegration = new apigateway.LambdaIntegration(getLambda);
      const getMethod = examples.addMethod('GET', getIntegration, { apiKeyRequired: true });

      const postIntegration = new apigateway.LambdaIntegration(createLambda);
      const postMethod = examples.addMethod('POST', postIntegration);

      // Usage Plans
      const usagePlan = api.addUsagePlan('usagePlan', {
        name: 'exampleUsage',
        quota: {
          limit: 10,
          period: apigateway.Period.DAY
        },
        throttle: {
          rateLimit: 10,
          burstLimit: 2
        }
      });

      usagePlan.addApiStage({
        stage: api.deploymentStage,
        throttle: [{
          method: getMethod,
          throttle: {
            rateLimit: 1,
            burstLimit: 2
          }
        }]
      });

      // Key Mgmt Lambda
      const apiKeyManagerLambda = new lambda.Function(this, 'apiKeyManagerLambda', {
        code: new lambda.AssetCode('src'),
        handler: 'src/keys.handler',
        runtime: lambda.Runtime.NODEJS_10_X,
        environment: {
          TABLE_NAME: regionApiKeyTable.tableName,
          PRIMARY_KEY: regionalPrimaryKeyName,
          USAGE_PLAN_ID: usagePlan.usagePlanId
        }
      });

      // Grant read access
      globalTable.grantStreamRead(apiKeyManagerLambda);
      regionApiKeyTable.grantReadWriteData(apiKeyManagerLambda);

      // Deadletter queue
      const triggerDLQueue = new sqs.Queue(this, 'triggerDLQueue');

      // Trigger Event
      apiKeyManagerLambda.addEventSource(new DynamoEventSource(globalTable, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 1,
        bisectBatchOnError: true,
        onFailure: new SqsDlq(triggerDLQueue),
        retryAttempts: 10
      }));


      // IAM Access
      apiKeyManagerLambda.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: ['arn:aws:apigateway:' + props.env.region + '::/tags/arn%3Aaws%3Aapigateway%3A' + props.env.region + '%3A%3A%2Fapikeys%2F*'],
          actions: ['apigateway:PUT']
        }) 
      );

      apiKeyManagerLambda.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: ['arn:aws:apigateway:' + props.env.region + '::/apikeys/*'],
          actions: ['apigateway:DELETE']
        })
      );

      apiKeyManagerLambda.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: ['arn:aws:apigateway:' + props.env.region + '::/apikeys'],
          actions: ['apigateway:POST']
        })
      );


      apiKeyManagerLambda.addToRolePolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          resources: ['arn:aws:apigateway:' + props.env.region + '::/usageplans/' + usagePlan.usagePlanId + '/keys'],
          actions: ['apigateway:POST']
        })
      );

      // ROUTE 53
      const zone = route53.HostedZone.fromLookup(this, "zone", { domainName: props.domainName });

      const globalApiRecord = new route53.CfnRecordSet(this, 'globalApiDomain', {
        name: props.subDomainName.concat(props.domainName + "."),
        type: "A",
        aliasTarget: {
          dnsName: restApiCustomDomain.domainNameAliasDomainName,
          hostedZoneId: restApiCustomDomain.domainNameAliasHostedZoneId 
        }, 
        hostedZoneId: zone.hostedZoneId,
        region: props.env.region,
        setIdentifier: "api-" + props.env.region
      });
    });
  }
}
