'use strict';

const dgram = require('dgram');
const Buffer = require('buffer').Buffer;
const urlParse = require('url').parse;
const crypto = require('crypto')
const torrentParser = require('./torrent-parser')
const util = require('./util')


function udpSend(socket, message, rawUrl, callback = ()=>{})
{
	const url = urlParse(rawUrl);
	if(!url.port)
	{
		url.port = 443;
	}
	socket.send(message, 0, message.length, url.port, url.hostname, callback);
}

function buildConnReq() {
  const buf = Buffer.allocUnsafe(16);

  // connection id
  buf.writeUInt32BE(0x417, 0);
  buf.writeUInt32BE(0x27101980, 4);
  // action
  buf.writeUInt32BE(0, 8);
  // transaction id
  crypto.randomBytes(4).copy(buf, 12);
  return buf;
}

function parseConnResp(resp)
{
	return {
		action:resp.readUInt32BE(0),
		transaction_id:resp.readUInt32BE(4),
		connection_id:resp.slice(8)
	}
}


function buildAnnounceReq(connId, torrent , port = 6881)
{
	const buf = Buffer.allocUnsafe(98);
	connId.copy(buf, 0);

	buf.writeUInt32BE(1, 8);
	crypto.randomBytes(4).copy(buf, 12);
	torrentParser.infoHash(torrent).copy(buf, 16);
	util.genId().copy(buf, 36);
	Buffer.alloc(8).copy(buf, 56);
	torrentParser.size(torrent).copy(buf, 64);
	Buffer.alloc(8).copy(buf, 72);
	buf.writeUInt32BE(0, 80);
	buf.writeUInt32BE(0, 84);
	crypto.randomBytes(4).copy(buf, 88);
	buf.writeInt32BE(-1,92);
	buf.writeUInt16BE(port, 96);

	return buf;
}


function parseAnnounceResp(resp)
{
	function group(iterable, groupSize)
	{
		let groups = []
		for(let i = 0;i<iterable.length; i+=groupSize)
		{
			groups.push(iterable.slice(i, i+groupSize));
		}
		return groups;
	}
	return {
		action: resp.readUInt32BE(0),
		transactionId: resp.readUInt32BE(4),
		interval: resp.readUInt32BE(8),
		leechers: resp.readUInt32BE(12),
		seeders: resp.readUInt32BE(16),
		peers: group(resp.slice(20), 6).map(address=>{
			return {
				ip: address.slice(0,4).join('.'),
				port: address.readUInt16BE(4)
			}
		})
	}
}

function respType(resp) {
	const action = resp.readUInt32BE(0);
	if(action == 0)
		return 'connect';
	if(action == 1)
		return 'announce';
}

module.exports.getPeers = (torrent, callback)=>{
	const socket = dgram.createSocket('udp4');
	const url = torrent.announce.toString('utf8');
	let send = ()=>udpSend(socket, buildConnReq(), url);
	/*let stop = false;
	let n = 0;
	while(!stop)
	{
		setTimeout(send, 2000*n);
		n++;
	}*/
	send();
	console.log("Request send");
	socket.on('message', response =>{
		if(respType(response) === 'connect')
		{
			console.log("Response Recieved");
			//stop = true;
			const connResp = parseConnResp(response);
			const announceReq = buildAnnounceReq(connResp.connection_id, torrent);
			udpSend(socket, announceReq, url);
		}
		else if(respType(response) === 'announce')
		{
			const announceResp = parseAnnounceResp(response);
			console.log("Connected to peers");
			callback(announceResp.peers);
		}
	})
}
