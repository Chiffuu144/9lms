const jwt = require('jsonwebtoken');
function auth(req,res,next){const token=req.cookies['auth-token'];if(!token)return res.status(401).json({error:'Unauthorized'});try{req.user=jwt.verify(token,process.env.JWT_SECRET||'group9-tup-secret-key-2024');next();}catch{return res.status(401).json({error:'Invalid or expired session'});}}
function role(expected){return (req,res,next)=>{if(req.user.role!==expected)return res.status(403).json({error:`Unauthorized - ${expected} only`});next();};}
module.exports={auth,role};
