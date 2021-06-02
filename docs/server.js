//NodeJS example

const tbClient = require('thingsboard-js-sdk')

//tb server config
const config = {
  host: "hostname",
  username: "username",
  password: "password"
}

//init client
const client = new tbClient(config);

const now = Date.now();

//device
const device = {
  keys: ['t'],
  limit: 10,
  agg: 'AVG',
  interval: 3600,
  startTs: now-360000,
  endTs: now,
  entityId: "xxx-xxx-xxx-xxx-xxxx"
};


async function getDevices(){

  const {token, user} = await client.connect();
  console.log('TOKEN', token)
  console.log('USER', user)

  const params = {} //use defaults

  devices = await client.getTenantDevices(params);
  console.log('DEVICES', devices.length);


  temperatures = await client.getTimeseries(device);
  console.log('TEMPS', temperatures);



}


getDevices()
