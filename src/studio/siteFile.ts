/** Read metadata before allowing GLTFLoader to process any resources. */
export function inspectSiteFile(bytes:ArrayBuffer) {
 if(bytes.byteLength<20||bytes.byteLength>32*1024*1024)throw Error("Choose a Looplet site file smaller than 32 MB.");
 const view=new DataView(bytes);
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength||view.getUint32(16,true)!==0x4e4f534a)throw Error("This is not a valid GLB site file.");
 const length=view.getUint32(12,true);if(length>bytes.byteLength-20)throw Error("Incomplete site file.");
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));
 if([...(json.buffers??[]),...(json.images??[])].some((item:{uri?:string})=>item.uri))throw Error("Site files must contain their own resources.");
 if(!Array.isArray(json.accessors??[])||(json.accessors??[]).some((item:{count:number})=>!Number.isSafeInteger(item.count)||item.count<0))throw Error("Invalid geometry size.");
 if((json.accessors??[]).reduce((sum:number,item:{count:number})=>sum+item.count,0)>4000000)throw Error("This site is too detailed to preview.");
 const site=json.scenes?.[json.scene??0]?.extras?.loopletSite;
 if(site?.schema!=="looplet.site/v1"||site.coordinateSystem?.unit!=="metre"||site.coordinateSystem?.verticalScale!==1)throw Error("Export this site from Looplet at Actual vertical scale.");
 if(!Array.isArray(site.center)||site.center.length!==2||!site.center.every(Number.isFinite)||Math.abs(site.center[0])>180||Math.abs(site.center[1])>90)throw Error("Site location is invalid.");
 if(site.address!==null&&typeof site.address!=="string")throw Error("Invalid site address.");
 if(site.terrain?.source&&['label','attribution','url'].some(key=>site.terrain.source[key]!=null&&typeof site.terrain.source[key]!=="string"))throw Error("Invalid terrain source information.");
 return site as {schema:string;address:string|null;center:[number,number];terrain:{source?:{label?:string;attribution?:string}|null};coordinateSystem:{verticalDatum:string};notes:string[]};
}
