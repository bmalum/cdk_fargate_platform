import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { IPAMPool } from './constructs/ipam';
import { aws_ec2 as ec2, aws_ecs as ecs } from 'aws-cdk-lib';
import { VpcConstruct } from './constructs/vpc_construct';

export class FargatePlatform extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const createIpam = process.env.CREATE_IPAM === 'true';

    let ipamPool;
    let vpc;

    if (createIpam) {
      ipamPool = new IPAMPool(this, 'MyIPAM', {
        regions: [
          'us-east-1',
          'eu-west-1',
          'eu-central-1'
        ],
        mainCidr: '10.0.0.0/8',
        // Optional netmask configuration
        netmaskConfig: {
          default: 22,
          min: 20,
          max: 22
        }
      });

      // Create VPC using the new VpcConstruct
      const vpcConstruct = new VpcConstruct(this, 'FargateVPC', {
        createIpam,
        ipamPool
      });
      vpc = vpcConstruct.vpc;

    } else {
      // Create VPC using lookup of default VPC
      vpc = ec2.Vpc.fromLookup(this, 'DefaultVPC', {
        isDefault: true
      });
    }

    // VPC endpoints are now managed by VpcConstruct

    // Create Fargate Cluster
    const cluster = new ecs.Cluster(this, 'FargateCluster', {
      vpc: vpc,
      clusterName: "FargateCluster",
      enableFargateCapacityProviders: true
    });

    // Add SSM Parameter to store VPC ID
    new cdk.aws_ssm.StringParameter(this, 'VpcIdParameter', {
      parameterName: 'fargate-platform-vpc-id',
      stringValue: vpc.vpcId,
      description: 'VPC ID for Fargate Platform',
      tier: cdk.aws_ssm.ParameterTier.STANDARD,
    });


    // Add SSM Parameter to store Cluster ARN
    new cdk.aws_ssm.StringParameter(this, 'ClusterArnParameter', {
      parameterName: 'fargate-platform-cluster-arn',
      stringValue: cluster.clusterArn,
      description: 'Cluster ARN for Fargate Platform',
      tier: cdk.aws_ssm.ParameterTier.STANDARD,
    });
  }
}