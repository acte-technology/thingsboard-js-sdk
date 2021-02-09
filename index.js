import axios from 'axios';
import jwt from 'jwt-decode';

const now = Date.now();

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

  // //connect and return public token from Thingsboard
  async connect(){

    const token = await axios.post('https://'+this.config.host+'/api/auth/login/public', { publicId: this.config.publicId })
      .then(function (response) {
        return response.data.token;
      })
      .catch(function (error) {
        return null;
      });

    if(token){
      this.token = token;
      this.api = api(this.config.host, token);
      return token;
    } else {
      return null;
    }


  }

  //connect and return public token from Thingsboard
  async authCustomer(){

    const token = await axios.post('https://'+this.config.host+'/api/auth/login', { username: this.config.username, password: this.config.password })
      .then(function (response) {
        sessionStorage.setItem('token', response.data.token)
        sessionStorage.setItem('user', JSON.stringify(jwt(response.data.token)))
        return response.data.token;
      })
      .catch(function (error) {
        console.error(error)
        return null;
      });

      if(token){
        this.token = token;
        this.api = api(this.config.host, token);
        return token;
      } else {
        return null;
      }

  }

  //disconnect
  disconnect(params){

    sessionStorage.removeItem('token');
    sessionStorage.removeItem('devices');
    sessionStorage.removeItem('user');
    return null;

  }




  //get customer devices
  // getDevices(params, callback) => {
  //
  //   return this.api.get('https://'+this.config.host+'/api/customer/'+params.customerId+"/devices?pageSize=10&page=0&sortProperty=createdTime&sortOrder=DESC")
  //     .then(function (response) {
  //       sessionStorage.setItem( 'devices', JSON.stringify(response.data.data) )
  //       callback(response.data.data);
  //     })
  //     .catch(function (error) {
  //       callback(null);
  //     });
  // }


  //get tenant devices
  getTenantDevices(params, callback){

    return this.api.get('/api/tenant/devices?pageSize=100&page=0&sortProperty=name&sortOrder=ASC')
      .then(function (response) {
        sessionStorage.setItem( 'devices', JSON.stringify(response.data.data) )
        callback(response.data.data);
      })
      .catch(function (error) {
        callback(null);
      });
  }


  async getKeys(params, callback){

    /*
      params = {
        entityId,
        scope (telemetries|attributes)
      }
    */
    const keysFunction = (params) => {

      return this.api.get('https://'+this.config.host+'/api/plugins/telemetry/DEVICE/'+params.entityId+'/keys/'+params.scope)
        .then(function (response) {
          //console.log(params.scope, response.data)
          callback(response.data);
          return response.data
        })
        .catch(function (error) {
          callback(null);
          return null
        });
    }

    switch (params.scope) {

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


  getAttributesByScope(params, callback){

    /*
      params = {
        entityId,
        scope (CLIENT_SCOPE|SHARED_SCOPE|SERVER_SCOPE),
        keys array
      }
    */

    return this.api.get('https://'+this.config.host+'/api/plugins/telemetry/DEVICE/'+params.entityId+'/values/attributes/'+params.scope+"?keys="+params.keys.join(','))
      .then(function (response) {
        //console.log(params.scope, response.data)
        callback(response.data);
        return response.data
      })
      .catch(function (error) {
        callback(null);
        return null
      });
  }



  async deleteEntityKeys(params, callback){

    /*
      params = {
          entityId,
          keys,
          scope,
          olderThan (seconds)
      }
    */

    const olderThan = Number(params.olderThan);

    if(params.olderThan === null){
      alert('Older Than must be set');
      return null;
    }

    const baseUrl = 'https://'+this.config.host+'/api/plugins/telemetry/DEVICE/'+params.entityId;
    let url;


    switch (params.scope) {
      case 'timeseries':
        if(olderThan === 0){

          url = baseUrl+'/timeseries/delete?keys='+params.keys.join(',')+'&deleteAllDataForKeys=true';

        } else {

          const startTs = 0;
          const endTs = now - (olderThan*1000);
          url = `${baseUrl}/timeseries/delete?keys=${params.keys.join(',')}&startTs=${startTs}&endTs=${endTs}&&deleteAllDataForKeys=false`;

        }
        break;
      case 'client':
        url = baseUrl+'/CLIENT_SCOPE?keys='+params.keys.join(',');
        break;
      case 'shared':
        url = baseUrl+'/SHARED_SCOPE?keys='+params.keys.join(',');
        break;
      case 'server':
        url = baseUrl+'/SERVER_SCOPE?keys='+params.keys.join(',');
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


  //websocket
  subscribe(params, callback){

    const wssUrl = "wss://"+this.config.host+"/api/ws/plugins/telemetry?token=" + this.token;
    var webSocket = new WebSocket(wssUrl);

    webSocket.onopen = function () {
        var object = {
          tsSubCmds: [
            {
              entityType: "DEVICE",
              entityId: params.entityId,
              scope: "LATEST_TELEMETRY",
              cmdId: params.cmdId
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


  getTimeseries(parameters, callback){

    const params = {
      keys: parameters.keys,
      limit: parameters.limit || 500,
      agg: parameters.agg || 'AVG',
      interval: parameters.interval || 60000,
      startTs: parameters.startTs || now-3600000,
      endTs: parameters.endTs || now,
      //raw: parameters.raw || false,
      useStrictDataTypes: true
    };


    return this.api.get(
      '/api/plugins/telemetry/DEVICE/'+parameters.entityId+'/values/timeseries',
      { params: params })
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


  async energyEstimation(params, callback){

    var now = Date.now();
    var date = new Date();
    var minutes = date.getMinutes();
    var month = date.getMonth();
    var year = date.getFullYear();
    var day = date.getDate();

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

        var first = en[0];
        var last = en.pop();

        var monthInMs = 30 * 24 * 60 * 60 * 1000;
        var dayInMs = 24 * 60 * 60 * 1000;

        var period = last.ts - first.ts;
        var energy = last.value - first.value;

        var estimation = [];

        estimation.first = first;
        estimation.last = last;
        estimation.energy = Math.round( (energy*monthInMs/period), 0);
        estimation.costs = Math.round( (estimation.energy * 3000), 0);

        //console.log('ESTIMATION', estimation);

        callback(estimation);
        return estimation;


      });



    } catch (e) {
      callback(null);
      return null;
    }
  }

}
