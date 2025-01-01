import * as cdk from 'aws-cdk-lib';
import { aws_ec2 as ec2, aws_ecs as ecs, aws_ecs_patterns as ecsPatterns, aws_ssm as ssm, aws_iam as iam, aws_secretsmanager as secretsmanager } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const clusterArn = ssm.StringParameter.valueForStringParameter(this,
            'fargate-platform-cluster-arn'
        );

        const vpcId = ssm.StringParameter.valueFromLookup(this, 'fargate-platform-vpc-id');
        
        const secret = new secretsmanager.Secret(this, 'MySecret', {
            generateSecretString: {
                passwordLength: 128,
                excludeCharacters: '/@"' // exclude problematic characters
            }
        });

        const vpc = ec2.Vpc.fromLookup(this, 'ImportedFargateVPC', {
            vpcId: vpcId
        });

        const cluster = ecs.Cluster.fromClusterAttributes(this, 'ImportedCluster', {
            clusterName: "FargateCluster",
            vpc
        });

        const executionRole = new iam.Role(this, 'TaskExecutionRole', {
            assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });

        executionRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')
        );

        executionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'ecr:GetAuthorizationToken',
                'ecr:BatchCheckLayerAvailability',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage'
            ],
            resources: ['*']
        }));

        const loadBalancedFargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Service', {
            cluster,
            memoryLimitMiB: 1024,
            desiredCount: 1,
            cpu: 512,
            assignPublicIp: false,
            runtimePlatform: {
                operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
                cpuArchitecture: ecs.CpuArchitecture.ARM64,
            },
            // healthCheck: {
            //     command: ['CMD-SHELL', 'curl -f http://localhost:4000/ || exit 1'],
            //     interval: cdk.Duration.seconds(30),
            //     timeout: cdk.Duration.seconds(5),
            //     retries: 3,
            //     startPeriod: cdk.Duration.seconds(60)
            // },
            taskImageOptions: {
                image: ecs.ContainerImage.fromEcrRepository(
                    cdk.aws_ecr.Repository.fromRepositoryName(this, "webtoolbox", "webtoolbox"),
                    "latest"
                ),
                containerPort: 4000,
                executionRole: executionRole,
                secrets: {
                    SECRET_KEY_BASE: ecs.Secret.fromSecretsManager(secret),
                },

            },
        });

        loadBalancedFargateService.targetGroup.configureHealthCheck({
            path: '/',
            healthyThresholdCount: 2,
            unhealthyThresholdCount: 3,
            timeout: cdk.Duration.seconds(5),
            interval: cdk.Duration.seconds(30),
        });

        const scalableTarget = loadBalancedFargateService.service.autoScaleTaskCount({
            minCapacity: 1,
            maxCapacity: 20,
        });

        scalableTarget.scaleOnCpuUtilization('CpuScaling', {
            targetUtilizationPercent: 50,
        });

        scalableTarget.scaleOnMemoryUtilization('MemoryScaling', {
            targetUtilizationPercent: 50,
        });
    }
}
