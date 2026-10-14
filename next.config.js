const path=require('path');
module.exports={reactStrictMode:true,poweredByHeader:false,webpack(c){c.resolve.alias['@']=__dirname;return c}}
