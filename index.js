import axios from 'axios';
import jwt from 'jwt-decode';

const api = (host, token = null) => axios.create({
    baseURL: `https://${host}`,
    responseType: "json",
    headers: {
      'X-Authorization': `Bearer ${token}`
    }
});


export default class tbClient {

  constructor(config){

    this.config = config;
    this.api = api(config.host, config.token);

    if(config.token){
      this.token = config.token;
    } else {
      this.token = null;
    }

  }

  // connect to Thingsboard
  async connect(public = false){

    let token;

    if(public === true){

      token = await this.api.post('/api/auth/login/public', { publicId: this.config.publicId })
        .then(function (response) {
          return response.data.token;
        })
        .catch(function (error) {
          return null;
        });

    } else {

      token = await this.api.post('/api/auth/login', { username: this.config.username, password: this.config.password })
        .then(function (response) {
          sessionStorage.setItem('tb_token', response.data.token)
          sessionStorage.setItem('tb_user', JSON.stringify(jwt(response.data.token)))
          return response.data.token;
        })
        .catch(function (error) {
          console.error(error)
          return null;
        });

    }

    if(token){
      this.token = token;
      this.api = api(this.config.host, token);
      return token;
    } else {
      return null;
    }

  }


  //disconnect
  disconnect(){
    sessionStorage.removeItem('tb_token');
    sessionStorage.removeItem('tb_user');
    return null;
  }

  //get tenant devices
  getTenantDevices(params, callback){

    const pageSize = params.pageSize || 100;
    const page = params.page || 0;
    const sortProperty = params.sortProperty || 'name';
    const sortOrder = params.sortOrder || 'ASC'

    return this.api.get(`/api/tenant/devices?pageSize=${pageSize}&page=${page}&sortProperty=${sortProperty}&sortOrder=${sortOrder}`)
      .then(function (response) {
        callback(response.data.data);
      })
      .catch(function (error) {
        callback(null);
      });
  }

  //get timeseries keys|attributes keys
  async getKeys(params, callback){

    const entityId = params.entityId;

    if(!entityId){
      console.error('entityId is undefined');
      return null;
      callback(null);
    }

    const scope = params.scope || 'timeseries';


    const keysFunction = (args) => {

      return this.api.get(`/api/plugins/telemetry/DEVICE/${args.entityId}/keys/${args.scope}`)
        .then(function (response) {
          callback(response.data);
          return response.data
        })
        .catch(function (error) {
          callback(null);
          return null
        });
    }

    switch (scope) {

      case 'client':
        params.scope = 'attributes/CLIENT_SCOPE';
        return keysFunction(params);

      case 'shared':
        params.scope = 'attributes/SHARED_SCOPE';
        return keysFunction(params);

      case 'server':
        params.scope = 'attributes/SERVER_SCOPE';
        return keysFunction(params);

      case 'timeseries':
        params.scope = 'timeseries';
        return keysFunction(params);

      default:
        params.scope = 'timeseries'
        return keysFunction(params);

    }

  }


  //get attributes by scope
  getAttributesByScope(params, callback){

    // params.scope: CLIENT_SCOPE | SHARED_SCOPE | SERVER_SCOPE

    const entityId = params.entityId;
    if(!entityId){
      console.log('undefined entityId')
      callback(null);
      return null;
    }

    const scope = params.scope || 'CLIENT_SCOPE';

    return this.api.get(`/api/plugins/telemetry/DEVICE/${params.entityId}/values/attributes/${scope}?keys=${params.keys.join(',')}`)
      .then(function (response) {
        callback(response.data);
        return response.data
      })
      .catch(function (error) {
        callback(null);
        return null
      });
  }


  async deleteEntityKeys(params, callback){

    const entityId = params.entityId;
    const keys = params.keys;

    const olderThan = Number(params.olderThan);
    if(params.olderThan === null){
      alert('Older Than must be set');
      return null;
    }

    //using fetch for delete method, had issues with testing server using axios. OPTIONS.
    const baseUrl = `https://${this.config.host}/api/plugins/telemetry/DEVICE/${entityId}`;
    let url;

    switch (params.scope) {
      case 'timeseries':
        if(olderThan === 0){

          url = `${baseUrl}/timeseries/delete?keys=${params.keys.join(',')}&deleteAllDataForKeys=true`;

        } else {

          const startTs = 0;
          const endTs = Date.now() - (olderThan*1000);
          url = `${baseUrl}/timeseries/delete?keys=${params.keys.join(',')}&startTs=${startTs}&endTs=${endTs}&&deleteAllDataForKeys=false`;

        }
        break;
      case 'client':
        url = `${baseUrl}/CLIENT_SCOPE?keys=${params.keys.join(',')}`;
        break;
      case 'shared':
        url = `${baseUrl}/SHARED_SCOPE?keys=${params.keys.join(',')}`;
        break;
      case 'server':
        url = `${baseUrl}/SERVER_SCOPE?keys=${params.keys.join(',')}`;
        break;
      default:
        console.error('Unrecognized scope');
        return null;
    }

    try {

      let response = await fetch((url),
        {
          method: "DELETE",
           headers: {
            'X-Authorization': `Bearer ${this.token}`
          }
        });

        return callback(response);

    } catch (e) {
      alert(e);
      return null;
    }


  }

  getTimeseries(params, callback){

    const now = Date.now();
    const entityId = params.entityId;
    const keys = params.keys || [];
    const limit = params.limit || 500;
    const agg = params.agg || 'AVG';
    const interval = params.interval || 60000;
    const startTs = params.startTs || now-3600000;
    const endTs = params.endTs || now;
    const useStrictDataTypes = params.useStrictDataTypes || true;

    return this.api.get(
      `/api/plugins/telemetry/DEVICE/${entityId}/values/timeseries`,
      {
        keys: keys,
        limit: limit,
        agg: agg,
        interval: interval,
        startTs: startTs,
        endTs: endTs,
        useStrictDataTypes: useStrictDataTypes
      })
      .then(function (response) {
        callback(response.data);
        return response.data;
      })
      .catch(function (error) {
        console.log(error);
        callback(null);
        return null;
      });

  }


  //websocket
  subscribe(params, callback){

    const entityId = params.entityId;
    const cmdId = params.cmdId || 10;

    const wssUrl = `wss://${this.config.host}/api/ws/plugins/telemetry?token=${this.token}`;
    var webSocket = new WebSocket(wssUrl);

    webSocket.onopen = function () {
        var object = {
          tsSubCmds: [
            {
              entityType: "DEVICE",
              entityId: entityId,
              scope: "LATEST_TELEMETRY",
              cmdId: cmdId
            }
          ],
          historyCmds: [],
          attrSubCmds: []
        };
        var data = JSON.stringify(object);
        webSocket.send(data);
        //callback(data);
    };

    webSocket.onmessage = function (event) {
        var received_msg = event.data;
        callback(JSON.parse(received_msg));
    };

    webSocket.onclose = function() {
        console.log('WEBSOCKET CLOSED');
        webSocket = null;
        callback(null);
    };

  }


  async energyEstimation(params, callback){

    const now = Date.now();
    const date = new Date();
    const minutes = date.getMinutes();
    const month = date.getMonth();
    const year = date.getFullYear();
    const day = date.getDate();

    if(day < 3){
      console.log('Estimated using past month data');
      if(month == 1){ month = 12; year = year - 1; }
      else{ month = month - 1; }

    } else {
      console.log('Estimated using this month data');
    }

    var startTs = Date.parse( new Date(year, month, 1, 0, 0, 0) ) ;
    var endTs = now - (minutes*1000) - (2*3600*1000); //interval 6hours
    var interval = 3600000 * 3;


    if(startTs >= endTs){
      console.log('Please wait a few hours for correct estimation...');
      callback(null);
      return null;
    }

    var parameters = {
      keys: 'energy',
      limit: 100,
      agg: 'MIN',
      interval: interval,
      startTs: startTs,
      endTs: endTs,
      entityId: params.entityId
    };

    try {

        var thisMonthValues = await this.getTimeseries(parameters, function (data){

        const en = data.energy;

        const first = en[0];
        const last = en.pop();

        const monthInMs = 30 * 24 * 60 * 60 * 1000;
        const dayInMs = 24 * 60 * 60 * 1000;

        const period = last.ts - first.ts;
        const energy = last.value - first.value;

        var estimation = [];
        estimation.first = first;
        estimation.last = last;
        estimation.energy = Math.round( (energy*monthInMs/period), 0);
        estimation.costs = Math.round( (estimation.energy * 3000), 0);

        callback(estimation);
        return estimation;

      });

    } catch (e) {
      callback(null);
      return null;
    }
  }

}
