import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
const hash = b => createHash('sha256').update(b).digest('hex');
const pngCache=new Map();
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
export function validatePng(bytes,digest=hash(bytes)) {
 if(pngCache.has(digest))return pngCache.get(digest);
 if(bytes.length<57||bytes.length>32*1024*1024||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Invalid PNG signature/size');
 let offset=8,width,height,channels,ended=false;const idat=[];
 while(offset<bytes.length){if(offset+12>bytes.length)throw Error('Truncated PNG');const length=bytes.readUInt32BE(offset),end=offset+12+length;if(end>bytes.length)throw Error('Truncated PNG chunk');const type=bytes.toString('ascii',offset+4,offset+8),body=bytes.subarray(offset+8,offset+8+length);if(crc32(bytes.subarray(offset+4,end-4))!==bytes.readUInt32BE(end-4))throw Error('Invalid PNG CRC');
  if(offset===8&&type!=='IHDR')throw Error('Missing IHDR');
  if(type==='IHDR'){if(width||length!==13)throw Error('Invalid IHDR');width=body.readUInt32BE(0);height=body.readUInt32BE(4);channels=({0:1,2:3,4:2,6:4})[body[9]];if(!width||!height||width>10000||height>100000||!channels||body[8]!==8||body[10]!==0||body[11]!==0||body[12]!==0)throw Error('Unsupported PNG dimensions/encoding');}
  if(type==='IDAT')idat.push(body);
  if(type==='IEND'){if(length||end!==bytes.length)throw Error('Invalid PNG ending');ended=true;}
  offset=end;
 }
 const expected=height*(1+width*channels);if(!ended||!idat.length||expected>256*1024*1024)throw Error('PNG missing image or oversized decoded data');
 const decoded=inflateSync(Buffer.concat(idat),{maxOutputLength:expected});if(decoded.length!==expected)throw Error('Invalid PNG image length');for(let row=0;row<height;row++)if(decoded[row*(1+width*channels)]>4)throw Error('Invalid PNG filter');
 const dimensions={width,height};if(pngCache.size>=128)pngCache.clear();pngCache.set(digest,dimensions);return dimensions;
}

