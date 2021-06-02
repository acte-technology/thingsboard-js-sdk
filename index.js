const axios = require('axios').default;
const jwt = require('jwt-decode').default;

const api = (host, token = null) => axios.create({
    baseURL: `https://${host}`,
    responseType: "json",
    headers: {
      'X-Authorization': `Bearer ${token}`
    }
});


class tbClient{

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
  // return {token: token, user: user} or null
  async connect(isPublic = false){

    let result;

    if(isPublic === true){

      result = await this.api.post('/api/auth/login/public', { publicId: this.config.publicId })
        .then(function (response) {

          return {
            token: response.data.token,
            user: null
          }

        })
        .catch(function (error) {
          return null;
        });

    } else {

      result = await this.api.post('/api/auth/login', { username: this.config.username, password: this.config.password })
        .then(function (response) {

          return {
            token: response.data.token,
            user: JSON.stringify(jwt(response.data.token))
          };

        })
        .catch(function (error) {
          console.error(error)
          return null;
        });

    }

    if(result){
      this.token = result.token;
      this.api = api(this.config.host, result.token);
      return result;
    } else {
      return null;
    }

  }


  //disconnect
  disconnect(){
    this.token = null;
    return null;
  }

  //get tenant devices
  getTenantDevices(params = {}, callback = null){

    const pageSize = params.pageSize || 100;
    const page = params.page || 0;
    const sortProperty = params.sortProperty || 'name';
    const sortOrder = params.sortOrder || 'ASC'

    return this.api.get(`/api/tenant/devices?pageSize=${pageSize}&page=${page}&sortProperty=${sortProperty}&sortOrder=${sortOrder}`)
      .then(function (response) {
        callback && callback(response.data.data)
        return response.data.data

      })
      .catch(function (error) {
        console.log(error)
        callback && callback(null);
        return null;
      });
  }

  //get timeseries keys|attributes keys
  async getKeys(params, callback = null){

    const entityId = params.entityId;

    if(!entityId){
      console.error('entityId is undefined');
      callback && callback(null);
      return null;
    }

    const scope = params.scope || 'timeseries';


    const keysFunction = (args) => {

      return this.api.get(`/api/plugins/telemetry/DEVICE/${args.entityId}/keys/${args.scope}`)
        .then(function (response) {
          callback && callback(response.data);
          return response.data
        })
        .catch(function (error) {
          callback && callback(null);
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
  getAttributesByScope(params, callback = null){

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
        callback && callback(response.data);
        return response.data
      })
      .catch(function (error) {
        callback && callback(null);
        return null
      });
  }


  async deleteEntityKeys(params, callback = null){

    const entityId = params.entityId;
    const keys = params.keys || [];
    const scope = params.scope || "";
    const olderThan = Number(params.olderThan || 0); //timestamp seconds

    //using fetch for delete method, had issues with testing server using axios. OPTIONS.
    const baseUrl = `https://${this.config.host}/api/plugins/telemetry/DEVICE/${entityId}`;
    let url;

    switch (scope) {
      case 'timeseries':
        if(olderThan === 0){

          url = `${baseUrl}/timeseries/delete?keys=${keys.join(',')}&deleteAllDataForKeys=true`;

        } else {

          const startTs = 0;
          const endTs = Date.now() - (olderThan*1000);
          url = `${baseUrl}/timeseries/delete?keys=${keys.join(',')}&startTs=${startTs}&endTs=${endTs}&&deleteAllDataForKeys=false`;

        }
        break;
      case 'client':
        url = `${baseUrl}/CLIENT_SCOPE?keys=${keys.join(',')}`;
        break;
      case 'shared':
        url = `${baseUrl}/SHARED_SCOPE?keys=${keys.join(',')}`;
        break;
      case 'server':
        url = `${baseUrl}/SERVER_SCOPE?keys=${keys.join(',')}`;
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

        callback && callback(response);
        return response;

    } catch (e) {
      alert(e);
      callback && callback(null)
      return null;
    }


  }

  getTimeseries(params, callback = null){

    const now = Date.now();
    const entityId = params.entityId;
    const keys = params.keys || [];
    const limit = params.limit || 500;
    const agg = params.agg || 'AVG';
    const interval = params.interval || 60000;
    const startTs = params.startTs || now-3600000;
    const endTs = params.endTs || now;
    const useStrictDataTypes = params.useStrictDataTypes || true;

    const getParams = {
      keys: keys.join(','),
      limit: limit,
      agg: agg,
      interval: interval,
      startTs: startTs,
      endTs: endTs,
      useStrictDataTypes: useStrictDataTypes
    }

    return this.api.get(
      `/api/plugins/telemetry/DEVICE/${entityId}/values/timeseries`, {params: getParams})
      .then(function (response) {
        callback && callback(response.data);
        return response.data;
      })
      .catch(function (error) {
        console.log(error);
        callback && callback(null);
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

}


module.exports = tbClient;
