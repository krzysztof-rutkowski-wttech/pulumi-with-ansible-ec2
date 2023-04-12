import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { local } from "@pulumi/command";

const config = new pulumi.Config();
const instanceType = config.get("instanceType") || "t3.micro";
const vpcNetworkCidr = config.get("vpcNetworkCidr") || "10.0.0.0/16";
const publicKey = config.get("publicKey") || '';
const privateKeyPath = './rsa';

const deployer = new aws.ec2.KeyPair("deployer", { publicKey, keyName: 'pulumi-ansible-instance-key' });

// Look up the latest Amazon Linux 2 AMI.
const ami = aws.ec2.getAmi({
    filters: [{
        name: "name",
        values: ["amzn2-ami-hvm-*"],
    }],
    owners: ["amazon"],
    mostRecent: true,
}).then(invoke => invoke.id);

// User data to start a HTTP server in the EC2 instance
const userData = `#!/bin/bash amazon-linux-extras install epel -y`;

// Create VPC.
const vpc = new aws.ec2.Vpc("vpc", {
    cidrBlock: vpcNetworkCidr,
    enableDnsHostnames: true,
    enableDnsSupport: true,
});

// Create an internet gateway.
const gateway = new aws.ec2.InternetGateway("gateway", {vpcId: vpc.id});

// Create a subnet that automatically assigns new instances a public IP address.
const subnet = new aws.ec2.Subnet("subnet", {
    vpcId: vpc.id,
    cidrBlock: "10.0.1.0/24",
    mapPublicIpOnLaunch: true,
});

// Create a route table.
const routeTable = new aws.ec2.RouteTable("routeTable", {
    vpcId: vpc.id,
    routes: [{
        cidrBlock: "0.0.0.0/0",
        gatewayId: gateway.id,
    }],
});

// Associate the route table with the public subnet.
const routeTableAssociation = new aws.ec2.RouteTableAssociation("routeTableAssociation", {
    subnetId: subnet.id,
    routeTableId: routeTable.id,
});

// Create a security group allowing inbound access over port 80 and outbound
// access to anywhere.
const secGroup = new aws.ec2.SecurityGroup("secGroup-krut", {
    description: "Enable HTTP access",
    vpcId: vpc.id,
    ingress: [{
        fromPort: 80,
        toPort: 80,
        protocol: "tcp",
        cidrBlocks: ["0.0.0.0/0"],
    },
    {
        fromPort: 22,
        toPort: 22,
        protocol: "tcp",
        cidrBlocks: ["0.0.0.0/0"],
    }],
    egress: [{
        fromPort: 0,
        toPort: 0,
        protocol: "-1",
        cidrBlocks: ["0.0.0.0/0"],
    }],
});

// Create and launch an EC2 instance into the public subnet.
const server = new aws.ec2.Instance("server-for-pulumi-testing-purposes", {
    instanceType: instanceType,
    subnetId: subnet.id,
    vpcSecurityGroupIds: [secGroup.id],
    userData: userData,
    ami: ami,
    tags: {
        Name: "pulumi-ansible-test",
    },
    keyName: 'pulumi-ansible-instance-key'
}, {
    dependsOn: [ deployer ]
});

// Render the Ansible playbook using RDS info.
const renderPlaybookCmd = new local.Command("renderPlaybookCmd", {
    create: "cat playbook.yaml | envsubst > playbook_rendered.yaml",
    environment: {
        HOST_IP_ADDRESS: server.publicIp,
        HOST_DNS: server.publicDns
    }
}, {
    dependsOn: [ server ],
});

// Play the Ansible playbook to finish installing.
const playAnsiblePlaybookCmd = new local.Command("playAnsiblePlaybookCmd", {
    create: pulumi.interpolate`ansible-playbook \
    -u ec2-user -i '${server.publicIp},' \
    --private-key ${privateKeyPath} \
    playbook_rendered.yaml`
}, {
    dependsOn: [ renderPlaybookCmd ],
});

// Export the instance's publicly accessible IP address and hostname.
export const ip = server.publicIp;
export const hostname = server.publicDns;
export const url = pulumi.interpolate`http://${server.publicDns}`;
export const renderPlaybookCmdId = renderPlaybookCmd.id;
