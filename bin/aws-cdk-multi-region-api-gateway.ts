#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AwsCdkMultiRegionApiGatewayStack } from '../lib/aws-cdk-multi-region-api-gateway-stack';

const app = new cdk.App();
new AwsCdkMultiRegionApiGatewayStack(app, 'AwsCdkMultiRegionApiGatewayStack');
