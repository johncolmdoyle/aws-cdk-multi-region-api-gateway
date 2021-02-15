#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AppStack } from '../lib/app-stack';
import { GlobalStack } from '../lib/global-stack';
import { CertStack } from '../lib/cert-stack';

// Route53 Domain Name
const zoneDomain = 'gizmo.codes';
const subDomain = 'global.';

// Table configuration
const globalTableName = 'multi-region-example';
const primaryKeyName = 'id';

// Region configurations
const primaryTableRegion = 'us-west-2';
const tableReplicatedRegions = ['us-east-2'];
const appRegions = ['us-east-2', 'us-west-2'];

const app = new cdk.App();

const globalstack = new GlobalStack(app, 'GlobalStack', {
    env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: primaryTableRegion},
    globalTableName: globalTableName,
    globalTablePrimaryKeyName: primaryKeyName,
    replicationRegions: tableReplicatedRegions
});

appRegions.forEach(function (item, index) {
  const certstack = new CertStack(app, 'CertStack-' + item, {
    env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: item},
    domainName: zoneDomain,
    subDomainName: subDomain
  });

  new AppStack(app, 'AppStack-' + item, {
    env: {account: process.env.CDK_DEFAULT_ACCOUNT, region: item},
    domainName: zoneDomain,
    subDomainName: subDomain,
    certificate: certstack.cert,
    globalTableName: globalTableName,
    globalTablePrimaryKeyName: primaryKeyName 
  });
});
