import * as cdk from '@aws-cdk/core';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as route53 from '@aws-cdk/aws-route53';

interface CertStackProps extends cdk.StackProps {
  readonly domainName: string;
  readonly subDomainName: string;
  readonly env: any;
}

export class CertStack extends cdk.Stack {
  public readonly cert: acm.ICertificate;

  constructor(scope: cdk.Construct, id: string, props: CertStackProps) {
    super(scope, id, props);
      // CERTIFICATE
      const zone = route53.HostedZone.fromLookup(this, "zone", { domainName: props.domainName });

      const certificate = new acm.Certificate(this, 'Certificate', {
         domainName: props.subDomainName.concat(props.domainName),
         validation: acm.CertificateValidation.fromDns(zone),
      });

      this.cert = certificate;
  }
}
