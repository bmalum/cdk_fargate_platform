import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ecr as ecr, aws_secretsmanager as secretsmanager, aws_iam as iam } from 'aws-cdk-lib';

export class ServiceRepoStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Create ECR repository with pull-through cache configuration
        const ecrRepo = new ecr.Repository(this, 'MyECRRepo', {
            repositoryName: process.env.REPO_NAME || process.env.APP_NAME || "webapp" ,
            imageScanOnPush: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        // Create secret in Secrets Manager for DockerHub credentials
        const dockerHubSecret = new secretsmanager.Secret(this, 'DockerHubCredentials', {
            secretName: 'ecr-pullthroughcache/dockerhub-bmalum',
            secretStringValue: cdk.SecretValue.unsafePlainText(JSON.stringify({
                username: process.env.DOCKERHUB_USERNAME || '',
                accessToken: process.env.DOCKERHUB_TOKEN || ''
            })),
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        // Configure pull-through cache rule
        const pullThroughCacheRule = new ecr.CfnPullThroughCacheRule(this, 'PullThroughCacheRule', {
            credentialArn: dockerHubSecret.secretFullArn,
            ecrRepositoryPrefix: "docker-hub",
            upstreamRegistryUrl: "registry-1.docker.io"
        });

        // Get the correct principal for the repository
        const principal = new iam.AccountRootPrincipal();
        // Grant pull permissions to ECR
        ecrRepo.grantPull(principal);
        // Grant read access to the secret
        dockerHubSecret.grantRead(principal);

        // Add ECR repository URL as stack output
        new cdk.CfnOutput(this, 'ECRRepositoryURL', {
            value: ecrRepo.repositoryUri,
            description: 'The URL of the ECR repository',
            exportName: 'ECRRepoURL'
        });
    }
}
