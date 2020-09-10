'use strict';
const fs = require('fs');
const bencode = require('bencode');
const torrentParser = require('./src/torrent-parser')
const tracker = require('./src/tracker')
const download = require('./src/download')

const torrent = torrentParser.open(process.argv[2]);
console.log(torrent);
/*
const files = torrent.info.files
console.log(torrent.info.name.toString('utf-8'));
files.forEach(file=>{
	console.log(file);
	const paths = file.path.toString('utf-8');
	console.log(paths);
})*/
let multiple = false;
if(torrent.info.hasOwnProperty("files"))
{
	multiple = true;
}
download(torrent, torrent.info.name, multiple);