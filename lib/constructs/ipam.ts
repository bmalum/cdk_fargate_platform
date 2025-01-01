import { CfnOutput, aws_ec2 as ec2 } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Duration, RemovalPolicy, StackProps, aws_ssm as ssm } from 'aws-cdk-lib';
import { CfnIPAM } from 'aws-cdk-lib/aws-ec2';

interface IPAMProps extends StackProps {
    regions: string[];
    mainCidr: string;
    netmaskConfig: {
        default: number;
        min: number;
        max: number;
    };
}

interface IPAMPoolConfig {
    id: string;
    locale: string;
    cidr: string;
}

export class IPAMPool extends Construct {
    public readonly ipam: ec2.CfnIPAM;
    public readonly ipamPool: ec2.CfnIPAMPool;
    public readonly regionalPools: ec2.CfnIPAMPool[];
    private readonly poolConfigs: IPAMPoolConfig[];
    private readonly netmaskConfig: {
        default: number;
        min: number;
        max: number;
    };

    constructor(scope: Construct, id: string, props: IPAMProps) {
        super(scope, id);

        // Set default netmask configuration or use provided values
        this.netmaskConfig = props.netmaskConfig || {
            default: 22,
            min: 20,
            max: 22
        };

        // Generate CIDR blocks for each region
        this.poolConfigs = this.generateRegionalCidrs(props.mainCidr, props.regions);

        // Create main IPAM
        this.ipam = this.createMainIPAM(props.regions);

        // Create main pool
        const mainPool = this.createMainPool(props.mainCidr);

        // Create regional pools
        this.regionalPools = this.createRegionalPools(mainPool);
        
        // Assign the first pool as the default
        this.ipamPool = this.regionalPools[0];

        // Create outputs for each regional pool
        this.createOutputs();
    }

    private generateRegionalCidrs(mainCidr: string, regions: string[]): IPAMPoolConfig[] {
        const [baseIp, mainCidrMask] = mainCidr.split('/');
        const mainMask = parseInt(mainCidrMask);
        
        // Calculate the size of regional CIDR blocks
        const regionalMask = mainMask + Math.ceil(Math.log2(regions.length));
        
        // Split the main CIDR into regional blocks
        return regions.map((region, index) => {
            const ipParts = baseIp.split('.');
            const shiftBits = 32 - regionalMask;
            const networkNum = index << shiftBits;
            
            // Calculate new IP for the region
            const newIp = (
                parseInt(ipParts[0]) << 24 | 
                parseInt(ipParts[1]) << 16 | 
                parseInt(ipParts[2]) << 8 | 
                parseInt(ipParts[3])
            ) + networkNum;

            const regionBaseIp = [
                (newIp >> 24) & 255,
                (newIp >> 16) & 255,
                (newIp >> 8) & 255,
                newIp & 255
            ].join('.');

            return {
                id: region,
                locale: region,
                cidr: `${regionBaseIp}/${regionalMask}`
            };
        });
    }

    private createMainIPAM(regions: string[]): ec2.CfnIPAM {
        return new ec2.CfnIPAM(this, 'MainIPAM', {
            description: 'Main IPAM for multi-region deployment',
            operatingRegions: regions.map(region => ({ regionName: region })),
            tags: [{ key: 'Name', value: 'MainPool' }],
            tier: 'advanced'
        });
    }

    private createMainPool(mainCidr: string): ec2.CfnIPAMPool {
        return new ec2.CfnIPAMPool(this, 'MainIPAMPool', {
            addressFamily: 'ipv4',
            ipamScopeId: this.ipam.attrPrivateDefaultScopeId,
            allocationDefaultNetmaskLength: this.netmaskConfig.default,
            allocationMaxNetmaskLength: this.netmaskConfig.max,
            allocationMinNetmaskLength: this.netmaskConfig.min,
            provisionedCidrs: [{ cidr: mainCidr }]
        });
    }

    private createRegionalPools(mainPool: ec2.CfnIPAMPool): ec2.CfnIPAMPool[] {
        return this.poolConfigs.map(config => 
            new ec2.CfnIPAMPool(this, `RegionalPool-${config.id}`, {
                addressFamily: 'ipv4',
                ipamScopeId: this.ipam.attrPrivateDefaultScopeId,
                sourceIpamPoolId: mainPool.attrIpamPoolId,
                allocationDefaultNetmaskLength: this.netmaskConfig.default,
                allocationMaxNetmaskLength: this.netmaskConfig.max,
                allocationMinNetmaskLength: this.netmaskConfig.min,
                locale: config.locale,
                provisionedCidrs: [{ cidr: config.cidr }]
            })
        );
    }

    private createOutputs(): void {
        this.poolConfigs.forEach((config, index) => {
            new CfnOutput(this, `IPAMPool-${config.id}`, {
                value: this.regionalPools[index].attrIpamPoolId,
                description: `IPAM Pool ID for ${config.locale}`
            });
        });
    }
}
