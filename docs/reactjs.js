import React, { useState, useEffect } from "react";

import tbClient from 'thingsboard-js-sdk';

//tb server config
const config = {
  host: "hostname",
  username: "username",
  password: "secret"
}

//init client
const client = new tbClient(config);

const now = Date.now();

//device
const device = {
  keys: ['temperature'],
  limit: 10,
  agg: 'AVG',
  interval: 3600,
  startTs: now-36000,
  endTs: now,
  entityId: "xxx-xxx-xxx"
};


//component
const TbClientHome = (props) => {

  const [ timeseries, setTimeseries ] = useState(null); //device timeseries
  const [ connected, setConnected ] = useState(null); //client is connected


  const connect = async () => {

    const token = await client.connect(); // connect() returns token or null

    if(token){
      setConnected(true);
      client.getTimeseries(device, setTimeseries);
    } else {
      alert('Login failed !!!');
      setConnected(false);
    }

  }

  useEffect(() => {
    connect();
  }, [])


  if(connected && timeseries && timeseries.length > 0){

    return(
      <div>
        <ul>
        {timeseries.temperature && timeseries.temperature.map((item, key) =>
          <li>{item.ts}: {item.value}</li>
        )}
        </ul>
      </div>
    );

  } else {
    return('Connecting...');
  }

}

export default TbClientHome;
