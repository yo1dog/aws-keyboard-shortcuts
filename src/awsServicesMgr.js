/* globals unsafeWindow */
const AWS_SERVICE_ALIASES_MAP = {
  /* AWS IoT               */ iot: ['Internet of Things'                     ],
  /* DMS                   */ dms: ['Database Migration Service'             ],
  /* EC2                   */ ec2: ['Elastic Compute Cloud'                  ],
  /* EC2 Container Service */ ecs: ['Elastic Compute Cloud Container Service'],
  /* EMR                   */ emr: ['Elastic MapReduce'                      ],
  /* IAM                   */ iam: ['Identity and Access Management'         ],
  /* RDS                   */ rds: ['Relational Database Service'            ],
  /* S3                    */ s3 : ['Simple Storage Service'                 ],
  /* SES                   */ ses: ['Simple Email Service'                   ],
  /* SNS                   */ sns: ['Simple Notification Service'            ],
  /* SQS                   */ sqs: ['Simple Queue Service'                   ],
  /* SWF                   */ swf: ['Simple Workflow'                        ],
  /* VPC                   */ vpc: ['Virtual Private Cloud'                  ],
  /* WAF                   */ waf: ['Web Application Firewall'               ]
};


let __awsServices;

function extractAWSServices() {
  // get the AWS console hostname
  // unsafeWindow is Greasemonkey/Tampermonkey's non-sandboxed window (the same window
  // a script running on the page would see)
  let awsConsoleHostname;
  if (unsafeWindow.ConsoleIncludes) {
    awsConsoleHostname = unsafeWindow.ConsoleIncludes.awsConsoleHostName;
  }
  else {
    awsConsoleHostname = window.location.hostname;
  }
  
  // get the metadata about the AWS services
  const awsMeta = extractAWSMeta();
  
  // use the meta data to create the AWS service objects
  const awsServices = createAWSServices(awsMeta, awsConsoleHostname);
  
  __awsServices = awsServices;
}

function getAWSServices() {
  if (!__awsServices) {
    throw new Error('Attempted to get AWS services before they were extracted.');
  }
  
  return __awsServices.slice(0);
}

function getAWSMetaElem() {
  const awsMetaElem = document.getElementsByName('awsc-mezz-data')[0];
  return awsMetaElem;
}

function extractAWSMeta() {
  // get the meta element which contains JSON meta data about all the AWS services
  const awsMetaElem = getAWSMetaElem();
  if (!awsMetaElem) {
    throw new Error('AWS services meta element does not exist.');
  }
  
  // get the JSON that is contained the meta elem's content attribute
  const metaJSON = awsMetaElem.getAttribute('content');
  
  // parse the JSON
  let awsMeta;
  try {
    awsMeta = JSON.parse(metaJSON);
  }
  catch(err) {
    throw new Error('AWS meta element contains invalid JSON.');
  }
  /*
  awsMeta = {
    services: [
      {
        "regions": [
          "ap-south-1",
          "eu-west-1",
          ...
        ],
        "cregions": [
          "ap-south-1",
          "eu-west-1",
          ...
        ],
        "group": "cdk",
        "label": "EC2",
        "description": "Amazon Elastic Compute Cloud (EC2) provides resizable compute capacity in the cloud.",
        "caption": "Virtual Servers in the Cloud",
        "id": "ec2",
        "url": "/ec2/v2/home"
      },
      ...
    ],
    serviceSpriteIdOrder: [
      'ec2',
      'emr',
      ...
    ],
    ...
  }
  */
  
  if (!awsMeta.services) {
    throw new Error('services missing from AWS meta JSON.');
  }
  if (!awsMeta.serviceSpriteIdOrder) {
    throw new Error('serviceSpriteIdOrder missing from AWS meta JSON.');
  }
  
  return awsMeta;
}

function findAWSServiceMeta(awsMeta, awsServiceId) {
  const awsServiceMeta = awsMeta.services.find(awsService => awsService.id === awsServiceId);
  return awsServiceMeta;
}

function createAWSServices(awsMeta, awsConsoleHostname) {
  const awsServices = [];
  
  // lets only show services that have an icon
  for (let i = 0; i < awsMeta.serviceSpriteIdOrder.length; ++i) {
    const awsServiceId = awsMeta.serviceSpriteIdOrder[i];
    const iconSpriteIndex = i;
    
    const awsServiceMeta = findAWSServiceMeta(awsMeta, awsServiceId);
    if (!awsServiceMeta) {
      throw new Error(`AWS service meta data does not exist for ID '${awsServiceId}' at index ${i}.`);
    }
    
    awsServices.push(createAWSService(awsServiceMeta, iconSpriteIndex, awsConsoleHostname));
  }
  
  return awsServices;
}

function createAWSService(awsServiceMeta, iconSpriteIndex, awsConsoleHostname) {
  // get properties from the meta
  const id    = awsServiceMeta.id;
  const url   = '//' + awsConsoleHostname + awsServiceMeta.url;
  const label = awsServiceMeta.label;
  
  if (!id)    throw new Error(`id missing from AWS service meta.`);
  if (!url)   throw new Error(`url missing from AWS service meta with ID '${id}).`);
  if (!label) throw new Error(`label missing from AWS service meta with ID '${id}).`);
  
  // get any known aliases
  const aliases = (AWS_SERVICE_ALIASES_MAP[id] || []).slice(0);
  
  const awsService = {
    id,
    url,
    label,
    aliases,
    iconSpriteIndex,
    meta: awsServiceMeta
  };
  return awsService;
}

module.exports = {
  extractAWSServices,
  getAWSServices,
  getAWSMetaElem
};