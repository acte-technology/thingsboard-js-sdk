# Thingsboard Javascript SDK

Thingsboard Javascript SDK

**Dev version, work in progress.**

Use example: https://acte.ltd/iot/client/login

## Installation

```bash
npm install thingsboard-js-sdk
```

## Methods

- connect
- disconnect
- subscribe (websocket)
- getTenantDevices
- getKeys (timeseries & attributes)
- deleteEntityKeys (timeseries & attributes)
- getAttributesByScope
- getTimeseries
- energyEstimation

### Import client class

```js
import tbClient from 'thingsboard-js-sdk';
const client = new tbClient(config);
```

### Connect to public device

```js
const client = new tbClient({
  host: 'localhost',
  publicId: 'xxx-xxx-xxx-xxx'
});

const connect = async () => {

  const token = await client.connect(true); //true for public login

}
```

### Connect with user/password

```js
const client = new tbClient({
  host: 'localhost',
  username: 'username',
  password: 'password'
});

const connect = async () => {

  const token = await client.connect();

}
```

### Get Tenant Devices

*must be logged as a tenant*

```js
const params = {
  pageSize: 100,
  page: 0,
  sortProperty: 'name',
  sortOrder: 'ASC'
}
//...
let devices = await client.getTenantDevices(params, callback)
```

### Get Keys

```js
const params = {
  entityId: 'xxx-xxx-xxx',
  scope: 'timeseries', //timeseries | client | shared | server
}
//...
let keys = await client.getKeys(params, callback)
```

### Get Attributes By Scope

```js
const params = {
  entityId: 'xxx-xxx-xxx',
  scope: 'CLIENT_SCOPE', // CLIENT_SCOPE | SHARED_SCOPE | SERVER_SCOPE
  keys: ['temperature', 'humidity']
}
//...
let attrs = await client.getAttributesByScope(params, callback)
```

### Delete keys

```js
const params = {
  entityId: 'xxx-xxx-xxx',
  keys: ['temperature', 'humidity'],
  olderThan: Date.now()-3600, //delete older than 1 hour
  scope: 'timeseries' // timeseries, client, shared, server
}
//...
let response = await client.deleteEntityKeys(params, callback)
```

### Get timeseries

```js
const now = Date.now();

const params = {
  entityId: 'xxx-xxx-xxx',
  keys: ['temperature', 'humidity']
  limit: 500,
  agg: 'AVG',
  interval: 60000,
  startTs: now-3600000,
  endTs: now,
  useStrictDataTypes: true
}
//...
let timeseries = await client.getTimeseries(params, callback)
```


### WSS Websocket subscribe

```js
const params = {
  entityId: 'xxx-xxx-xxx',
  cmdId: 10 //websocket id
}
//...
let keys = await client.subscribe(params, callback)
```
