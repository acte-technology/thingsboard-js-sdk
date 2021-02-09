# Thingsboard Javascript SDK

Thingsboard Javascript SDK


## Installation

```bash
npm install thingsboard-js-sdk
```

## Methods

- Constructor class (host, token)
- Connect
- Disconnect
- Subscribe (websocket)
- getTenantDevices
- getKeys (timeseries & attributes)
- deleteEntityKeys (timeseries & attributes)
- getAttributesByScope
- getTimeseries
- energyEstimation


## Examples

### Import class

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

## Dev version, work in progress.
( documentation in progress... )
