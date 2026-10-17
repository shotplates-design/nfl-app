const path=require('path');
module.exports={reactStrictMode:true,poweredByHeader:false,
  // /props has no index page (only /props/[slug]); send stray visitors to the public home page instead of a 404.
  async redirects(){return [{source:'/props',destination:'/',permanent:false}]},
  webpack(c){c.resolve.alias['@']=__dirname;return c}}
