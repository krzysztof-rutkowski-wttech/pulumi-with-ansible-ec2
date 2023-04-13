# Pulumi with Ansible

## About

Example of how to combine Pulumi with Ansible (using TypeScript)
The aim is to use Pulumi to:
 * create EC2 instance;
 * run Ansible script with params passed via environemnt;
 * Ansible playbook to install nginx on the instance
 * and create example page containing instance IP address taken from Pulumi EC2 resource.

## Prerequisites
 - nodeJS
 - Ansible - [installation guide](https://docs.ansible.com/ansible/latest/installation_guide/intro_installation.html)
 - Pulumi - [installation guide](https://www.pulumi.com/docs/get-started/install/)

## Project Set Up & Configuration
Install nodeJS modules for the project:
```sh
$ npm install
```

Use pulumi command line tool to configure a project.
First initialize stack:
```sh
$ pulumi stack init [<org-name>/]<stack-name>
```
for example:
```sh
$ pulumi stack init my-organization/dev
```
Then select the stack ('pulumi-ec2' is the project name defined in Pulumi.yaml file)
```sh
$ pulumi stack select [<org-name>/]pulumi-ec2/<stack-name>
```

Set up basic Pulumi configuration for AWS and EC2 instance. In this example 'rnd' profile will be used.

```sh
$ pulumi config set aws:profile rnd && \
pulumi config set aws:region eu-central-1 && \
pulumi config set pulumi-ec2:instanceType t3.micro && \
pulumi config set pulumi-ec2:vpcNetworkCidr 10.0.0.0/16
```

Now config file for the selected stack should be created and found in the file 'Pulumi.\<stack-name>.yaml' (e.g. Pulumi.dev.yaml).

To be able to access EC2 instance via ssh a security key pair is needed.
Run the command to create one ('mykey' is an example of key name):
```sh
ssh-keygen -t rsa -b 2048 -f mykey
```

Add private key name (required by ansible playbook) and public key to the configraton:
```sh
pulumi config set pulumi-ec2:privateKeyName mykey
pulumi config set pulumi-ec2:publicKey "$(cat mykey.pub)"
```

# Running

Run a command:

```sh
$ pulumi up
```

or with auto confirm deployment:

```sh
$ pulumi up --yes
```

When deployment is finished, some outputs will be given:

```sh
Outputs:
    hostname: "<domain-name-address>"
    ip      : <ip-address>
    url     : "http://<domain-name-address>"
```

Open http://\<domain-name-address> or http://\<ip-address> in the web browser and see the page content that should look like the following text:

```sh
Hello from 3.120.157.17 :-)
```

