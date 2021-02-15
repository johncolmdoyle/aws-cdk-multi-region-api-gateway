import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as AwsCdkMultiRegionApiGateway from '../lib/aws-cdk-multi-region-api-gateway-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new AwsCdkMultiRegionApiGateway.AwsCdkMultiRegionApiGatewayStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
