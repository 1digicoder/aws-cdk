import * as cxapi from '@aws-cdk/cx-api';
import * as sinon from 'sinon';
import { DEFAULT_REPO_LIFECYCLE, ToolkitInfo } from '../lib';
import { prepareContainerAsset } from '../lib/docker';
import * as os from '../lib/os';
import { MockSDK } from './util/mock-sdk';

test('creates repository with given name', async () => {
  // GIVEN

  let createdName;

  const sdk = new MockSDK();
  sdk.stubEcr({
    describeRepositories() {
      return { repositories: [] };
    },

    createRepository(req) {
      createdName = req.repositoryName;

      // Stop the test so that we don't actually docker build
      throw new Error('STOPTEST');
    },
  });

  const toolkit = new ToolkitInfo({
    sdk,
    bucketName: 'BUCKET_NAME',
    bucketEndpoint: 'BUCKET_ENDPOINT',
    environment: { name: 'env', account: '1234', region: 'abc' }
  });

  // WHEN
  const asset: cxapi.ContainerImageAssetMetadataEntry = {
    id: 'assetId',
    imageNameParameter: 'MyParameter',
    packaging: 'container-image',
    path: '/foo',
    repositoryName: 'some-name',
    sourceHash: '0123456789abcdef',
  };

  try {
    await prepareContainerAsset('.', asset, toolkit, false);
  } catch (e) {
    if (!/STOPTEST/.test(e.toString())) { throw e; }
  }

  // THEN
  expect(createdName).toBe('some-name');
});

test('derives repository name from asset id', async () => {
  // GIVEN

  let createdName;

  const sdk = new MockSDK();
  sdk.stubEcr({
    describeRepositories() {
      return { repositories: [] };
    },

    createRepository(req) {
      createdName = req.repositoryName;

      // Stop the test so that we don't actually docker build
      throw new Error('STOPTEST');
    },
  });

  const toolkit = new ToolkitInfo({
    sdk,
    bucketName: 'BUCKET_NAME',
    bucketEndpoint: 'BUCKET_ENDPOINT',
    environment: { name: 'env', account: '1234', region: 'abc' }
  });

  // WHEN
  const asset: cxapi.ContainerImageAssetMetadataEntry = {
    id: 'Stack:Construct/ABC123',
    imageNameParameter: 'MyParameter',
    packaging: 'container-image',
    path: '/foo',
    sourceHash: '0123456789abcdef',
  };

  try {
    await prepareContainerAsset('.', asset, toolkit, false);
  } catch (e) {
    if (!/STOPTEST/.test(e.toString())) { throw e; }
  }

  // THEN
  expect(createdName).toBe('cdk/stack-construct-abc123');
});

test('configures lifecycle policy and image scanning', async () => {
  // GIVEN
  let putLifecyclePolicyParams;
  let putImageScanningConfigurationParams;

  const sdk = new MockSDK();
  sdk.stubEcr({
    describeRepositories() {
      return { repositories: [] };
    },

    createRepository() {
      return {
        repository: {
          repositoryUri: 'uri'
        }
      };
    },

    putLifecyclePolicy(params) {
      putLifecyclePolicyParams = params;
      return {};
    },

    putImageScanningConfiguration(params) {
      putImageScanningConfigurationParams = params;

      // Stop the test so that we don't actually docker build
      throw new Error('STOPTEST');
    }
  });

  const toolkit = new ToolkitInfo({
    sdk,
    bucketName: 'BUCKET_NAME',
    bucketEndpoint: 'BUCKET_ENDPOINT',
    environment: { name: 'env', account: '1234', region: 'abc' }
  });

  // WHEN
  const asset: cxapi.ContainerImageAssetMetadataEntry = {
    id: 'assetId',
    imageNameParameter: 'MyParameter',
    packaging: 'container-image',
    path: '/foo',
    repositoryName: 'some-name',
    sourceHash: '0123456789abcdef',
  };

  try {
    await prepareContainerAsset('.', asset, toolkit, false);
  } catch (e) {
    if (!/STOPTEST/.test(e.toString())) { throw e; }
  }

  // THEN
  expect(putLifecyclePolicyParams).toEqual({
    repositoryName: 'some-name',
    lifecyclePolicyText: JSON.stringify(DEFAULT_REPO_LIFECYCLE)
  });

  expect(putImageScanningConfigurationParams).toEqual({
    repositoryName: 'some-name',
    imageScanningConfiguration: {
      scanOnPush: true
    }
  });
});

test('passes the correct target to docker build', async () => {
  // GIVEN
  const toolkit = new ToolkitInfo({
    sdk: new MockSDK(),
    bucketName: 'BUCKET_NAME',
    bucketEndpoint: 'BUCKET_ENDPOINT',
    environment: { name: 'env', account: '1234', region: 'abc' }
  });

  const prepareEcrRepositoryStub = sinon.stub(toolkit, 'prepareEcrRepository').resolves({
    repositoryUri: 'uri',
    repositoryName: 'name'
  });

  const shellStub = sinon.stub(os, 'shell').rejects('STOPTEST');

  // WHEN
  const asset: cxapi.ContainerImageAssetMetadataEntry = {
    id: 'assetId',
    imageNameParameter: 'MyParameter',
    packaging: 'container-image',
    path: '/foo',
    sourceHash: '1234567890abcdef',
    repositoryName: 'some-name',
    buildArgs: {
      a: 'b',
      c: 'd'
    },
    target: 'a-target',
  };

  try {
    await prepareContainerAsset('.', asset, toolkit, false, false);
  } catch (e) {
    if (!/STOPTEST/.test(e.toString())) { throw e; }
  }

  // THEN
  const command = ['docker', 'build', '--build-arg', 'a=b', '--build-arg', 'c=d', '--tag', `uri:latest`, '/foo', '--target', 'a-target'];
  expect(shellStub.calledWith(command)).toBeTruthy();

  prepareEcrRepositoryStub.restore();
  shellStub.restore();
});

test('passes the correct args to docker build', async () => {
  // GIVEN
  const toolkit = new ToolkitInfo({
    sdk: new MockSDK(),
    bucketName: 'BUCKET_NAME',
    bucketEndpoint: 'BUCKET_ENDPOINT',
    environment: { name: 'env', account: '1234', region: 'abc' }
  });

  const prepareEcrRepositoryStub = sinon.stub(toolkit, 'prepareEcrRepository').resolves({
    repositoryUri: 'uri',
    repositoryName: 'name'
  });

  const shellStub = sinon.stub(os, 'shell').rejects('STOPTEST');

  // WHEN
  const asset: cxapi.ContainerImageAssetMetadataEntry = {
    id: 'assetId',
    imageNameParameter: 'MyParameter',
    packaging: 'container-image',
    path: '/foo',
    sourceHash: '1234567890abcdef',
    repositoryName: 'some-name',
    buildArgs: {
      a: 'b',
      c: 'd'
    }
  };

  try {
    await prepareContainerAsset('.', asset, toolkit, false);
  } catch (e) {
    if (!/STOPTEST/.test(e.toString())) { throw e; }
  }

  // THEN
  const command = ['docker', 'build', '--build-arg', 'a=b', '--build-arg', 'c=d', '--tag', `uri:latest`, '/foo'];
  expect(shellStub.calledWith(command)).toBeTruthy();

  prepareEcrRepositoryStub.restore();
  shellStub.restore();
});

test('relative path', async () => {
  // GIVEN
  const toolkit = new ToolkitInfo({
    sdk: new MockSDK(),
    bucketName: 'BUCKET_NAME',
    bucketEndpoint: 'BUCKET_ENDPOINT',
    environment: { name: 'env', account: '1234', region: 'abc' }
  });

  const prepareEcrRepositoryStub = sinon.stub(toolkit, 'prepareEcrRepository').resolves({
    repositoryUri: 'uri',
    repositoryName: 'name'
  });

  const shellStub = sinon.stub(os, 'shell').rejects('STOPTEST');

  // WHEN
  const asset: cxapi.ContainerImageAssetMetadataEntry = {
    id: 'assetId',
    imageNameParameter: 'MyParameter',
    packaging: 'container-image',
    path: 'relative-to-assembly',
    sourceHash: '1234567890abcdef',
    repositoryName: 'some-name',
    buildArgs: {
      a: 'b',
      c: 'd'
    }
  };

  try {
    await prepareContainerAsset('/assembly/dir/root', asset, toolkit, false);
  } catch (e) {
    if (!/STOPTEST/.test(e.toString())) { throw e; }
  }

  // THEN
  const command = ['docker', 'build', '--build-arg', 'a=b', '--build-arg', 'c=d', '--tag', `uri:latest`, '/assembly/dir/root/relative-to-assembly'];
  expect(shellStub.calledWith(command)).toBeTruthy();

  prepareEcrRepositoryStub.restore();
  shellStub.restore();
});
