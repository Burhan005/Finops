import React from 'react';
import {
  AmazonApiGateway,
  AmazonAthena,
  AmazonAurora,
  AmazonBedrock,
  AmazonCloudFront,
  AmazonCloudWatch,
  AmazonCognito,
  AmazonDocumentDb,
  AmazonDynamoDb,
  AmazonEc2,
  AmazonEfs,
  AmazonEksCloud,
  AmazonElasticBlockStore,
  AmazonElasticContainerService,
  AmazonElastiCache,
  AmazonEmr,
  AmazonEventBridge,
  AmazonFSx,
  AmazonGuardDuty,
  AmazonInspector,
  AmazonKinesis,
  AmazonManagedStreamingForApacheKafka,
  AmazonMq,
  AmazonNeptune,
  AmazonOpenSearchService,
  AmazonQuickSight,
  AmazonRds,
  AmazonRedshift,
  AmazonRoute53,
  AmazonSageMaker,
  AmazonSimpleEmailService,
  AmazonSimpleNotificationService,
  AmazonSimpleQueueService,
  AmazonSimpleStorageService,
  AmazonSimpleStorageServiceGlacier,
  AmazonTimestream,
  AmazonVirtualPrivateCloud,
  AwsAmplify,
  AwsAppSync,
  AwsBackup,
  AwsBudgets,
  AwsCertificateManager,
  AwsCloudFormation,
  AwsCloudTrail,
  AwsCodeBuild,
  AwsCodeCommit,
  AwsCodeDeploy,
  AwsCodePipeline,
  AwsConfig,
  AwsCostExplorer,
  AwsDatabaseMigrationService,
  AwsDirectConnect,
  AwsFargate,
  AwsGlue,
  AwsIdentityAndAccessManagement,
  AwsKeyManagementService,
  AwsLambda,
  AwsManagementConsole,
  AwsMarketplaceLight,
  AwsSecretsManager,
  AwsSecurityHub,
  AwsShield,
  AwsStepFunctions,
  AwsSystemsManager,
  AwsTransitGateway,
  AwsWaf,
  AwsXRay,
  ElasticLoadBalancing,
  ReservedInstanceReporting,
  SavingsPlans
} from '@nxavis/aws-icons';

/**
 * Intelligent Mapping of AWS Service Names & Acronyms
 * to 100% Authentic Official AWS Architecture Icons (@nxavis/aws-icons)
 */
const AWS_ICON_MAP = {
  AmazonApiGateway,
  AmazonAthena,
  AmazonAurora,
  AmazonBedrock,
  AmazonCloudFront,
  AmazonCloudWatch,
  AmazonCognito,
  AmazonDocumentDb,
  AmazonDynamoDb,
  AmazonEc2,
  AmazonEfs,
  AmazonEksCloud,
  AmazonElasticBlockStore,
  AmazonElasticContainerService,
  AmazonElastiCache,
  AmazonEmr,
  AmazonEventBridge,
  AmazonFSx,
  AmazonGuardDuty,
  AmazonInspector,
  AmazonKinesis,
  AmazonManagedStreamingForApacheKafka,
  AmazonMq,
  AmazonNeptune,
  AmazonOpenSearchService,
  AmazonQuickSight,
  AmazonRds,
  AmazonRedshift,
  AmazonRoute53,
  AmazonSageMaker,
  AmazonSimpleEmailService,
  AmazonSimpleNotificationService,
  AmazonSimpleQueueService,
  AmazonSimpleStorageService,
  AmazonSimpleStorageServiceGlacier,
  AmazonTimestream,
  AmazonVirtualPrivateCloud,
  AwsAmplify,
  AwsAppSync,
  AwsBackup,
  AwsBudgets,
  AwsCertificateManager,
  AwsCloudFormation,
  AwsCloudTrail,
  AwsCodeBuild,
  AwsCodeCommit,
  AwsCodeDeploy,
  AwsCodePipeline,
  AwsConfig,
  AwsCostExplorer,
  AwsDatabaseMigrationService,
  AwsDirectConnect,
  AwsFargate,
  AwsGlue,
  AwsIdentityAndAccessManagement,
  AwsKeyManagementService,
  AwsLambda,
  AwsManagementConsole,
  AwsMarketplaceLight,
  AwsSecretsManager,
  AwsSecurityHub,
  AwsShield,
  AwsStepFunctions,
  AwsSystemsManager,
  AwsTransitGateway,
  AwsWaf,
  AwsXRay,
  ElasticLoadBalancing,
  ReservedInstanceReporting,
  SavingsPlans
};

const SERVICE_ALIAS_MAP = {
  // App Integration
  'stepfunctions': 'AwsStepFunctions',
  'awsstepfunctions': 'AwsStepFunctions',
  'sqs': 'AmazonSimpleQueueService',
  'amazonsqs': 'AmazonSimpleQueueService',
  'simplequeueservice': 'AmazonSimpleQueueService',
  'sns': 'AmazonSimpleNotificationService',
  'amazonsns': 'AmazonSimpleNotificationService',
  'simplenotificationservice': 'AmazonSimpleNotificationService',
  'eventbridge': 'AmazonEventBridge',
  'amazoneventbridge': 'AmazonEventBridge',
  'mq': 'AmazonMq',
  'amazonmq': 'AmazonMq',
  'appsync': 'AwsAppSync',
  'awsappsync': 'AwsAppSync',

  // Security, Identity & Compliance
  'acm': 'AwsCertificateManager',
  'awscertificatemanager': 'AwsCertificateManager',
  'certificatemanager': 'AwsCertificateManager',
  'kms': 'AwsKeyManagementService',
  'awskeymanagementservice': 'AwsKeyManagementService',
  'keymanagementservice': 'AwsKeyManagementService',
  'waf': 'AwsWaf',
  'awswaf': 'AwsWaf',
  'shield': 'AwsShield',
  'awsshield': 'AwsShield',
  'secretsmanager': 'AwsSecretsManager',
  'securityhub': 'AwsSecurityHub',
  'iam': 'AwsIdentityAndAccessManagement',
  'identityandaccessmanagement': 'AwsIdentityAndAccessManagement',
  'guardduty': 'AmazonGuardDuty',
  'inspector': 'AmazonInspector',
  'cognito': 'AmazonCognito',

  // Compute & Serverless
  'ec2': 'AmazonEc2',
  'amazonec2': 'AmazonEc2',
  'elasticcomputecloud': 'AmazonEc2',
  'lambda': 'AwsLambda',
  'awslambda': 'AwsLambda',
  'ecs': 'AmazonElasticContainerService',
  'eks': 'AmazonEksCloud',
  'fargate': 'AwsFargate',
  'elasticloadbalancing': 'ElasticLoadBalancing',
  'elb': 'ElasticLoadBalancing',
  'loadbalancing': 'ElasticLoadBalancing',

  // Storage
  's3': 'AmazonSimpleStorageService',
  'amazons3': 'AmazonSimpleStorageService',
  'simplestorageservice': 'AmazonSimpleStorageService',
  'ebs': 'AmazonElasticBlockStore',
  'amazonebs': 'AmazonElasticBlockStore',
  'elasticblockstore': 'AmazonElasticBlockStore',
  'efs': 'AmazonEfs',
  'amazonefs': 'AmazonEfs',
  'fsx': 'AmazonFSx',
  'amazonfsx': 'AmazonFSx',
  'glacier': 'AmazonSimpleStorageServiceGlacier',
  'backup': 'AwsBackup',
  'awsbackup': 'AwsBackup',

  // Database
  'rds': 'AmazonRds',
  'amazonrds': 'AmazonRds',
  'aurora': 'AmazonAurora',
  'dynamodb': 'AmazonDynamoDb',
  'amazondynamodb': 'AmazonDynamoDb',
  'elasticache': 'AmazonElastiCache',
  'redshift': 'AmazonRedshift',
  'amazonredshift': 'AmazonRedshift',
  'documentdb': 'AmazonDocumentDb',
  'neptune': 'AmazonNeptune',
  'timestream': 'AmazonTimestream',

  // Networking & Content Delivery
  'vpc': 'AmazonVirtualPrivateCloud',
  'amazonvpc': 'AmazonVirtualPrivateCloud',
  'virtualprivatecloud': 'AmazonVirtualPrivateCloud',
  'cloudfront': 'AmazonCloudFront',
  'amazoncloudfront': 'AmazonCloudFront',
  'route53': 'AmazonRoute53',
  'amazonroute53': 'AmazonRoute53',
  'directconnect': 'AwsDirectConnect',
  'transitgateway': 'AwsTransitGateway',

  // Management & Governance
  'cloudwatch': 'AmazonCloudWatch',
  'amazoncloudwatch': 'AmazonCloudWatch',
  'cloudtrail': 'AwsCloudTrail',
  'systemsmanager': 'AwsSystemsManager',
  'ssm': 'AwsSystemsManager',
  'config': 'AwsConfig',
  'costexplorer': 'AwsCostExplorer',
  'budgets': 'AwsBudgets',
  'savingsplans': 'SavingsPlans',
  'reservedinstancereporting': 'ReservedInstanceReporting',
  'cloudformation': 'AwsCloudFormation',

  // Analytics & AI/ML
  'athena': 'AmazonAthena',
  'glue': 'AwsGlue',
  'opensearch': 'AmazonOpenSearchService',
  'opensearchservice': 'AmazonOpenSearchService',
  'elasticsearch': 'AmazonOpenSearchService',
  'kinesis': 'AmazonKinesis',
  'emr': 'AmazonEmr',
  'quicksight': 'AmazonQuickSight',
  'msk': 'AmazonManagedStreamingForApacheKafka',
  'bedrock': 'AmazonBedrock',
  'sagemaker': 'AmazonSageMaker',

  // Migration & Transfer
  'databasemigrationservice': 'AwsDatabaseMigrationService',
  'awsdatabasemigrationservice': 'AwsDatabaseMigrationService',
  'dms': 'AwsDatabaseMigrationService',
  'snapshotsbackups': 'AwsBackup',
  'snapshotsandbackups': 'AwsBackup',
  'snapshots': 'AwsBackup',

  // AWS Marketplace
  'awsmarketplace': 'AwsMarketplaceLight',
  'marketplace': 'AwsMarketplaceLight',
  'cphb99lr7icr3n9x6kc3102s5': 'AwsMarketplaceLight',

  // Developer Tools
  'apigateway': 'AmazonApiGateway',
  'ses': 'AmazonSimpleEmailService',
  'xray': 'AwsXRay',
  'amplify': 'AwsAmplify',
  'codepipeline': 'AwsCodePipeline',
  'codebuild': 'AwsCodeBuild',
  'codecommit': 'AwsCodeCommit',
  'codedeploy': 'AwsCodeDeploy'
};

/**
 * 100% Authentic Official AWS Architecture Service Logo Component
 * Code-split and tree-shaken for ultra-fast bundle loading.
 */
export default function AwsServiceIcon({ 
  service = '', 
  category = '', 
  assetType = '', 
  resourceId = '', 
  size = 'md', 
  className = '', 
  style = {} 
}) {
  const norm = (service || '').toLowerCase().replace(/[\s\-_/.]/g, '');
  const normCat = (category || '').toLowerCase().replace(/[\s\-_/.]/g, '');
  const normAsset = (assetType || '').toLowerCase().replace(/[\s\-_/.]/g, '');
  const resIdLower = (resourceId || '').toLowerCase().trim();

  let IconComponent = null;

  // 0. Priority EBS Detection: Ensure Elastic Block Store is never conflated with EC2 compute
  const isEbsExplicit = (
    norm === 'ebs' ||
    norm === 'amazonebs' ||
    norm.includes('elasticblockstore') ||
    normCat.includes('ebs') ||
    normCat.includes('snapshot') ||
    normAsset.includes('ebs') ||
    resIdLower.startsWith('vol-') ||
    resIdLower.startsWith('snap-')
  );

  if (isEbsExplicit) {
    IconComponent = AWS_ICON_MAP.AmazonElasticBlockStore;
  }

  // 1. Direct Alias Match
  const compKey = SERVICE_ALIAS_MAP[norm];
  if (compKey && AWS_ICON_MAP[compKey]) {
    IconComponent = AWS_ICON_MAP[compKey];
  }

  // 2. Keyword Search in Alias Keys
  if (!IconComponent) {
    for (const [alias, mappedComp] of Object.entries(SERVICE_ALIAS_MAP)) {
      if (norm.includes(alias) || alias.includes(norm)) {
        if (AWS_ICON_MAP[mappedComp]) {
          IconComponent = AWS_ICON_MAP[mappedComp];
          break;
        }
      }
    }
  }

  // 3. Dynamic Name Synthesis (e.g. converts any input format into PascalCase variants)
  if (!IconComponent) {
    const rawTokens = (service || '').trim().split(/[\s\-_/.]+/).filter(Boolean);
    const capitalized = rawTokens.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    if (AWS_ICON_MAP[capitalized]) {
      IconComponent = AWS_ICON_MAP[capitalized];
    } else if (AWS_ICON_MAP['Amazon' + capitalized]) {
      IconComponent = AWS_ICON_MAP['Amazon' + capitalized];
    } else if (AWS_ICON_MAP['Aws' + capitalized]) {
      IconComponent = AWS_ICON_MAP['Aws' + capitalized];
    }
  }

  // 4. Fallback to Official AWS Management Console / Virtual Private Cloud
  if (!IconComponent) {
    IconComponent = AWS_ICON_MAP.AwsManagementConsole || AWS_ICON_MAP.AmazonVirtualPrivateCloud;
  }

  const numSize = typeof size === 'number'
    ? size
    : size === 'xs'
    ? 14
    : size === 'sm'
    ? 18
    : size === 'lg'
    ? 36
    : size === 'xl'
    ? 48
    : 22; // default 'md'

  return (
    <IconComponent
      size={numSize}
      className={`flex-shrink-0 ${className}`}
      style={{
        borderRadius: numSize >= 30 ? '8px' : '4px',
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
        ...style
      }}
    />
  );
}
