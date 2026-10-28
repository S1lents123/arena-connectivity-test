import {createServer} from 'node:http';

const port=Number(process.env.PORT||3000);
createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.url!=='/test'){
    res.end(JSON.stringify({status:'ready',testEndpoint:'/test'}));
    return;
  }
  try{
    const response=await fetch('https://arena.ai/',{
      signal:AbortSignal.timeout(15000),
      redirect:'follow'
    });
    const body=(await response.text()).slice(0,100000);
    res.end(JSON.stringify({
      httpStatus:response.status,
      finalUrl:response.url.split('?')[0],
      cloudflareChallenge:/just a moment|cf-chl|checking your browser/i.test(body),
      accessible:response.ok&&!/just a moment|cf-chl|checking your browser/i.test(body),
      note:'HTTP connectivity only; authenticated browser access is not tested.'
    }));
  }catch(error){
    res.end(JSON.stringify({accessible:false,error:error.message}));
  }
}).listen(port,'0.0.0.0',()=>console.log(`Test server listening on ${port}`));
