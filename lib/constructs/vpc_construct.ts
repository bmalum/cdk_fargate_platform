import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { IPAMPool } from './ipam';

interface VpcConstructProps {
  createIpam?: boolean;
  ipamPool?: IPAMPool;
}

export class VpcConstruct extends Construct {
  public readonly vpc: ec2.IVpc;

  constructor(scope: Construct, id: string, props: VpcConstructProps) {
    super(scope, id);

    const requiredVpcEndpoints = [
      { service: ec2.InterfaceVpcEndpointAwsService.ECR, name: 'ecr' },
      { service: ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER, name: 'ecr-docker' },
      { service: ec2.InterfaceVpcEndpointAwsService.EVENTBRIDGE, name: 'eventbridge' },
      { service: ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS, name: 'logs' },
      { service: ec2.InterfaceVpcEndpointAwsService.SSM, name: 'ssm' },
      { service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER, name: 'secrets' },
      { service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES, name: 'ssm-messages' },
      { service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES, name: 'ec2-messages' },
      { service: ec2.InterfaceVpcEndpointAwsService.KINESIS_STREAMS, name: 'kinesis-streams' },
      { service: ec2.InterfaceVpcEndpointAwsService.SQS, name: 'sqs' }
    ];

    if (props.createIpam && props.ipamPool) {
      // Create VPC using IPAM pool
      this.vpc = new ec2.Vpc(this, 'VPC', {
        ipAddresses: ec2.IpAddresses.awsIpamAllocation({
          ipv4NetmaskLength: 22,
          defaultSubnetIpv4NetmaskLength: 26,
          ipv4IpamPoolId: props.ipamPool.ipamPool.attrIpamPoolId,
        }),
        maxAzs: 3,
        createInternetGateway: true, 
        enableDnsHostnames: true,
        enableDnsSupport: true,
        subnetConfiguration: [
          {
            cidrMask: 26,
            name: 'Public',
            subnetType: ec2.SubnetType.PUBLIC,
          },
          {
            cidrMask: 26,
            name: 'Private',
            subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          },
          {
            cidrMask: 26,
            name: 'Private_with_Egress',
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          }
        ]
      });
    } else {
      // Use existing default VPC
      this.vpc = ec2.Vpc.fromLookup(this, 'VPC', { isDefault: true });
    }

    // Add VPC endpoints
    requiredVpcEndpoints.forEach(({ service, name }) => {
      new ec2.InterfaceVpcEndpoint(this, `${name}-Interface`, {
        vpc: this.vpc,
        service: service,
        subnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED
        },
        privateDnsEnabled: true,
      });
    });

    // Add S3 Gateway endpoint
    this.vpc.addGatewayEndpoint("s3-gateway-endpoint", {
      service: ec2.GatewayVpcEndpointAwsService.S3
    });
  }
}