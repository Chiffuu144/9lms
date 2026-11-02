require('dotenv').config();
const express=require('express'); const cors=require('cors'); const cookieParser=require('cookie-parser'); const bcrypt=require('bcryptjs'); const jwt=require('jsonwebtoken'); const multer=require('multer'); const path=require('path'); const fs=require('fs');
const {Readable}=require('stream');
const connectDb=require('./config/db'); const uploadToCloudinary=require('./config/cloudinary'); const {User,Subject,Topic,Quiz,Score,TopicGateAttempt,QuizAttempt}=require('./models'); const {auth,role}=require('./middleware/auth');
const app=express(); const port=process.env.PORT||5000; const clientOrigin=process.env.CLIENT_URL||'http://localhost:5173';
app.use(cors({origin:clientOrigin,credentials:true})); app.use(express.json({limit:'2mb'})); app.use(cookieParser());
const uploadDir=path.join(__dirname,'uploads');fs.mkdirSync(uploadDir,{recursive:true});const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:50*1024*1024}});
const topicAssetsDir=path.join(__dirname,'..','public','topics');
const publicUser=u=>({id:u._id.toString(),email:u.email,username:u.username,fullName:u.fullName,role:u.role,studentId:u.studentId,facultyId:u.facultyId,yearLevel:u.yearLevel,section:u.section,department:u.department,profileImageUrl:u.profileImageUrl,profileImageName:u.profileImageName});
const generateStudentId=async()=>{let candidate;do{candidate=`TUP-STU-${new Date().getFullYear()}-${Math.floor(100000+Math.random()*900000)}`;}while(await User.exists({studentId:candidate}));return candidate;};
const generateFacultyId=async()=>{let candidate;do{candidate=`TUP-FAC-${new Date().getFullYear()}-${Math.floor(100000+Math.random()*900000)}`;}while(await User.exists({facultyId:candidate}));return candidate;};
const ensureStudentId=async user=>{if(user&&user.role==='student'&&!user.studentId){user.studentId=await generateStudentId();await user.save();}return user;};
const ensureFacultyId=async user=>{if(user&&user.role==='faculty'&&!user.facultyId){user.facultyId=await generateFacultyId();await user.save();}return user;};
app.get('/api/health',(req,res)=>res.json({ok:true}));
app.get('/api/topic-assets',auth,async(req,res)=>{
  const subjectId=String(req.query.subjectId||'');
  if(!subjectId)return res.status(400).json({error:'subjectId is required'});
  const subject=await ownedSubject(subjectId,req.user);
  if(!subject)return res.status(403).json({error:'You do not have access to this subject'});
  const topicNum=String(req.query.topicNum||'');
  if(topicNum&&(!Number.isInteger(Number(topicNum))||Number(topicNum)<1))return res.status(400).json({error:'topicNum must be a positive integer'});
  const topics=await Topic.find({subjectId}).select('topicNumber');
  const allowedTopics=new Set(topics.map(topic=>Number(topic.topicNumber)));
  if(req.user.role==='student'){
    const passedTopics=await Score.find({studentId:req.user.userId,subjectId,passed:true}).distinct('topicNumber');
    const passed=new Set(passedTopics.map(Number));
    for(const number of [...allowedTopics])if(number>1&&!passed.has(number-1))allowedTopics.delete(number);
  }
  const entries=[];
  const walk=(directory,relative='')=>{
    if(!fs.existsSync(directory))return;
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      const absolute=path.join(directory,entry.name);
      const nextRelative=path.join(relative,entry.name);
      if(entry.isDirectory())walk(absolute,nextRelative);
      else {
        const extension=path.extname(entry.name).toLowerCase();
        const match=entry.name.match(/(?:topic|itpe3-g)(\d+)/i)||nextRelative.match(/topic[-_]?(\d+)/i);
        if(!match)return;
        const number=Number(match[1]);
        if(topicNum&&number!==Number(topicNum)||!allowedTopics.has(number))return;
        const assetPath=nextRelative.split(path.sep).join('/');
        entries.push({name:entry.name,path:assetPath,extension,size:fs.statSync(absolute).size,url:`/api/topic-assets/file?subjectId=${encodeURIComponent(subjectId)}&path=${encodeURIComponent(assetPath)}`});
      }
    }
  };
  walk(topicAssetsDir);
  res.json({assets:entries});
});
app.get('/api/topic-assets/file',auth,async(req,res)=>{
  const subjectId=String(req.query.subjectId||'');
  const requestedPath=String(req.query.path||'');
  if(!subjectId||!requestedPath)return res.status(400).json({error:'subjectId and path are required'});
  if(!await ownedSubject(subjectId,req.user))return res.status(403).json({error:'You do not have access to this subject'});
  const filePath=path.resolve(topicAssetsDir,requestedPath);
  const relativePath=path.relative(topicAssetsDir,filePath);
  if(!relativePath||relativePath.startsWith('..')||path.isAbsolute(relativePath))return res.status(400).json({error:'Invalid topic asset path'});
  const match=path.basename(relativePath).match(/(?:topic|itpe3-g)(\d+)/i)||relativePath.match(/topic[-_]?(\d+)/i);
  if(!match)return res.status(404).json({error:'Topic asset not found'});
  const topicNumber=Number(match[1]);
  if(req.user.role==='student'){
    if(!await Topic.exists({subjectId,topicNumber}))return res.status(404).json({error:'Topic asset not found'});
    if(topicNumber>1&&!await Score.exists({studentId:req.user.userId,subjectId,topicNumber:topicNumber-1,passed:true}))return res.status(403).json({error:'Pass the previous topic quiz with at least 75% first.'});
  }
  if(!['.pdf','.ppt','.pptx'].includes(path.extname(filePath).toLowerCase())||!fs.existsSync(filePath)||!fs.statSync(filePath).isFile())return res.status(404).json({error:'Topic asset not found'});
  const extension=path.extname(filePath).toLowerCase();
  res.type(extension);
  res.set('Content-Disposition',extension==='.pdf'?'inline':`attachment; filename="${path.basename(filePath).replace(/"/g,'')}"`);
  res.sendFile(filePath);
});
app.post('/api/auth/register',upload.single('profileImage'),async(req,res)=>{try{const b=req.body;const email=String(b.email||'').trim().toLowerCase();const username=String(b.username||email.split('@')[0]||'').trim().toLowerCase();const fullName=String(b.fullName||'').trim();const password=String(b.password||'');if(!b.role||!fullName||!email||!username||!password)return res.status(400).json({error:'Name, username, email, and password are required'});if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Enter a valid email address'});if(fullName.length>120)return res.status(400).json({error:'Name must be 120 characters or fewer'});if(!['student','faculty'].includes(b.role))return res.status(400).json({error:'Invalid role'});if(!/^[a-z0-9._-]{3,30}$/.test(username))return res.status(400).json({error:'Username must be 3–30 characters using letters, numbers, dots, underscores, or hyphens'});if(password.length<8||password.length>128)return res.status(400).json({error:'Password must be between 8 and 128 characters'});if(b.role==='student'&&(!b.yearLevel||!b.section))return res.status(400).json({error:'Year level and section are required for students'});if(b.role==='faculty'&&!b.department)return res.status(400).json({error:'Department is required for faculty'});if(await User.findOne({$or:[{email},{username}]}))return res.status(409).json({error:'Email or username already registered'});if(req.file&&!req.file.mimetype.startsWith('image/'))return res.status(400).json({error:'Profile image must be an image file'});const profileImageUrl=req.file?await uploadToCloudinary(req.file,{folder:'group9/profile-images',resourceType:'image'}):'';const studentId=b.role==='student'?await generateStudentId():undefined;const facultyId=b.role==='faculty'?await generateFacultyId():undefined;const u=await User.create({role:b.role,email,username,fullName,password:await bcrypt.hash(password,12),studentId,yearLevel:b.yearLevel,section:b.section,facultyId,department:b.department,profileImageUrl,profileImageName:req.file?.originalname||''});res.status(201).json({success:true,user:publicUser(u)});}catch(e){if(e.code===11000)return res.status(409).json({error:'Email, username, or account ID already registered'});console.error(e);res.status(500).json({error:'Internal server error'});}});
app.post('/api/auth/login',async(req,res)=>{try{const identifier=String(req.body.username||req.body.email||'').trim().toLowerCase();const password=String(req.body.password||'');const u=await User.findOne({$or:[{email:identifier},{username:identifier}]});if(!u||!(await bcrypt.compare(password,u.password)))return res.status(401).json({error:'Invalid credentials'});await ensureStudentId(u);await ensureFacultyId(u);const secret=process.env.JWT_SECRET;if(!secret)return res.status(500).json({error:'Authentication is not configured'});const token=jwt.sign({userId:u._id.toString(),email:u.email,role:u.role,fullName:u.fullName},secret,{expiresIn:'7d'});res.cookie('auth-token',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:process.env.NODE_ENV==='production'?'none':'lax',maxAge:604800000});res.json({success:true,user:publicUser(u)});}catch(e){console.error(e);res.status(500).json({error:'Internal server error'});}});
app.post('/api/auth/logout',(req,res)=>{res.clearCookie('auth-token');res.json({success:true});});app.get('/api/auth/me',auth,async(req,res)=>{const user=await ensureFacultyId(await ensureStudentId(await User.findById(req.user.userId)));res.json({user:publicUser(user)});});
app.put('/api/auth/profile',auth,upload.single('profileImage'),async(req,res)=>{try{const update={};['fullName','yearLevel','section','department'].forEach(key=>{if(req.body[key]!==undefined)update[key]=String(req.body[key]).trim();});if(req.file){update.profileImageUrl=await uploadToCloudinary(req.file,{folder:'group9/profile-images',resourceType:'image'});update.profileImageName=req.file.originalname;}const user=await User.findByIdAndUpdate(req.user.userId,update,{new:true,runValidators:true});if(!user)return res.status(404).json({error:'User not found'});res.json({user:publicUser(user)});}catch(e){console.error(e);res.status(500).json({error:'Unable to update profile'});}});
app.get('/api/subjects',auth,async(req,res)=>{const q=req.user.role==='faculty'?{facultyId:req.user.userId}:{enrolledStudents:req.user.userId};res.json({subjects:await Subject.find(q).select('subjectCode subjectName term yearLevel facultyId createdAt').populate('facultyId','fullName email department').sort({createdAt:-1})});});
app.post('/api/subjects',auth,role('faculty'),async(req,res)=>{const subjectCode=String(req.body.subjectCode||'').trim();const subjectName=String(req.body.subjectName||'').trim();const {term,yearLevel}=req.body;if(!subjectCode||subjectCode.length>32||!subjectName||subjectName.length>120||!['1st Sem','2nd Sem','Summer'].includes(term)||!yearLevel)return res.status(400).json({error:'Enter a valid subject code, name, term, and year level'});res.status(201).json({subject:await Subject.create({subjectCode,subjectName,term,yearLevel,facultyId:req.user.userId,enrolledStudents:[]})});});
app.get('/api/subjects/all',auth,async(req,res)=>res.json({subjects:await Subject.find().select('subjectCode subjectName term yearLevel').sort({createdAt:-1})}));
app.get('/api/subjects/:id',auth,async(req,res)=>{const subject=await ownedSubject(req.params.id,req.user);if(!subject)return res.status(404).json({error:'Subject not found'});await subject.populate('facultyId','fullName email department');if(req.user.role==='student')subject.enrolledStudents=[];res.json({subject});});
app.get('/api/subjects/:id/students',auth,role('faculty'),async(req,res)=>{const subject=await Subject.findOne({_id:req.params.id,facultyId:req.user.userId}).populate({path:'enrolledStudents',select:'fullName studentId email yearLevel section',options:{sort:{fullName:1}}});if(!subject)return res.status(404).json({error:'Subject not found'});res.json({students:subject.enrolledStudents,count:subject.enrolledStudents.length});});
app.post('/api/subjects/:id/enroll',auth,role('student'),async(req,res)=>{const subject=await Subject.findByIdAndUpdate(req.params.id,{$addToSet:{enrolledStudents:req.user.userId}},{new:true}).populate('facultyId','fullName email department');if(!subject)return res.status(404).json({error:'Subject not found'});subject.enrolledStudents=[];res.json({subject,message:'Successfully enrolled in subject'});});
app.patch('/api/subjects/:id',auth,role('faculty'),async(req,res)=>{const update={};['subjectCode','subjectName','term','yearLevel'].forEach(key=>{if(req.body[key]!==undefined)update[key]=typeof req.body[key]==='string'?req.body[key].trim():req.body[key];});if(update.subjectCode!==undefined&&(!update.subjectCode||update.subjectCode.length>32)||update.subjectName!==undefined&&(!update.subjectName||update.subjectName.length>120)||update.term!==undefined&&!['1st Sem','2nd Sem','Summer'].includes(update.term)||update.yearLevel!==undefined&&!update.yearLevel)return res.status(400).json({error:'Enter valid subject details'});const subject=await Subject.findOneAndUpdate({_id:req.params.id,facultyId:req.user.userId},{$set:update},{new:true,runValidators:true});if(!subject)return res.status(404).json({error:'Subject not found'});res.json({subject});});
app.delete('/api/subjects/:id',auth,role('faculty'),async(req,res)=>{const subject=await Subject.findOneAndDelete({_id:req.params.id,facultyId:req.user.userId});if(!subject)return res.status(404).json({error:'Subject not found'});const quizIds=await Quiz.distinct('_id',{subjectId:subject._id});await Promise.all([Topic.deleteMany({subjectId:subject._id}),Quiz.deleteMany({subjectId:subject._id}),Score.deleteMany({subjectId:subject._id}),TopicGateAttempt.deleteMany({subjectId:subject._id}),QuizAttempt.deleteMany({quizId:{$in:quizIds}})]);res.json({success:true});});
const ownedSubject=async(subjectId,user)=>user.role==='faculty'?Subject.findOne({_id:subjectId,facultyId:user.userId}):Subject.findOne({_id:subjectId,enrolledStudents:user.userId});
app.get('/api/topics',auth,async(req,res)=>{if(!req.query.subjectId)return res.status(400).json({error:'subjectId is required'});if(!await ownedSubject(req.query.subjectId,req.user))return res.status(403).json({error:'You do not have access to this subject'});const topics=await Topic.find({subjectId:req.query.subjectId}).sort({topicNumber:1});if(req.user.role==='student'){const[completed,quizTopicIds]=await Promise.all([TopicGateAttempt.find({studentId:req.user.userId,subjectId:req.query.subjectId,passed:true}).select('topicId'),Quiz.distinct('topicId',{subjectId:req.query.subjectId,isActive:true})]);const passed=new Set(completed.map(item=>String(item.topicId)));const available=new Set(quizTopicIds.map(String));res.json({topics:topics.map(topic=>({_id:topic._id,subjectId:topic.subjectId,topicNumber:topic.topicNumber,title:topic.title,description:topic.description,isVerifiedComplete:topic.isVerifiedComplete,selfAssessmentPassed:passed.has(String(topic._id)),quizAvailable:available.has(String(topic._id)),isActive:topic.isActive}))});return;}res.json({topics});});
app.get('/api/topics/access',auth,async(req,res)=>{const topicNumber=Number(req.query.topicNumber);if(!req.query.subjectId||!Number.isInteger(topicNumber)||topicNumber<1)return res.status(400).json({error:'A valid subject and topic number are required'});if(!await ownedSubject(req.query.subjectId,req.user))return res.status(403).json({error:'You do not have access to this subject'});if(req.user.role==='faculty'||topicNumber===1)return res.json({allowed:true});const allowed=Boolean(await Score.exists({studentId:req.user.userId,subjectId:req.query.subjectId,topicNumber:topicNumber-1,passed:true}));res.json({allowed,reason:allowed?'':'Pass the previous topic quiz with at least 75% first.'});});
const validateQuizPayload=quiz=>{
  if(!quiz||typeof quiz!=='object'||!quiz.topicId||!quiz.subjectId||!String(quiz.title||'').trim()||String(quiz.title).trim().length>120||!Array.isArray(quiz.questions)||quiz.questions.length<1)return 'A valid quiz title and at least one question are required';
  if(quiz.questions.length>20)return 'Maximum 20 questions per quiz';
  const timeLimit=quiz.timeLimit===undefined?600:Number(quiz.timeLimit);
  if(!Number.isInteger(timeLimit)||timeLimit<60||timeLimit>1200)return 'Time limit must be between 1 and 20 minutes';
  for(const [index,question] of quiz.questions.entries()){
    if(!question||typeof question!=='object')return `Question ${index+1} is invalid`;
    const type=question.type;
    const answer=String(question.correctAnswer||'').trim();
    const points=question.points===undefined?1:Number(question.points);
    if(!['multiple_choice','true_false','identification'].includes(type)||!String(question.questionText||'').trim()||String(question.questionText).length>1000||!answer||answer.length>300)return `Question ${index+1} is incomplete or too long`;
    if(!Number.isFinite(points)||points<=0)return `Question ${index+1} must have a positive point value`;
    if(type==='multiple_choice'){
      if(!Array.isArray(question.choices)||question.choices.length>8)return `Question ${index+1} must have between two and eight choices`;
      const choices=question.choices.map(choice=>String(choice||'').trim()).filter(Boolean);
      if(choices.some(choice=>choice.length>300))return `Question ${index+1} choices must be 300 characters or fewer`;
      if(choices.length<2||new Set(choices.map(choice=>choice.toLowerCase())).size!==choices.length)return `Question ${index+1} must have at least two unique choices`;
      if(!choices.some(choice=>choice.toLowerCase()===answer.toLowerCase()))return `Question ${index+1} correct answer must match one of its choices`;
    }
    if(type==='true_false'&&!['true','false'].includes(answer.toLowerCase()))return `Question ${index+1} answer must be True or False`;
  }
  return '';
};
const studentQuiz=quiz=>({
  _id:quiz._id,
  topicId:quiz.topicId,
  subjectId:quiz.subjectId,
  title:quiz.title,
  timeLimit:quiz.timeLimit,
  passingScore:quiz.passingScore,
  questionCount:quiz.questions.length,
  isActive:quiz.isActive,
  questions:quiz.questions.map(({_id,type,questionText,choices,points})=>({_id,type,questionText,choices,points}))
});
const studentCanAccessQuiz=async(quiz,studentId)=>{
  const topic=await Topic.findOne({_id:quiz.topicId,subjectId:quiz.subjectId}).select('topicNumber selfAssessmentPrompt');
  if(!topic)return false;
  if(!topic.selfAssessmentPrompt?.trim())return false;
  const gatePassed=await TopicGateAttempt.exists({studentId,topicId:topic._id,passed:true});
  if(!gatePassed)return false;
  return Number(topic.topicNumber)<=1||Boolean(await Score.exists({
    studentId,subjectId:quiz.subjectId,topicNumber:Number(topic.topicNumber)-1,passed:true
  }));
};
app.get('/api/topics/subject/:subjectId/topic/:topicNumber',auth,async(req,res)=>{const topicNumber=Number(req.params.topicNumber);if(!Number.isInteger(topicNumber)||topicNumber<1)return res.status(400).json({error:'Invalid topic number'});const subject=await ownedSubject(req.params.subjectId,req.user);if(!subject)return res.status(403).json({error:'You do not have access to this subject'});const topic=await Topic.findOne({subjectId:req.params.subjectId,topicNumber});if(!topic)return res.status(404).json({error:'Topic content not found'});if(req.user.role==='student'&&topicNumber>1&&!await Score.exists({studentId:req.user.userId,subjectId:req.params.subjectId,topicNumber:topicNumber-1,passed:true}))return res.status(403).json({error:'Pass the previous topic quiz with at least 75% first.'});const data=topic.toObject();data.quizAvailable=Boolean(await Quiz.exists({topicId:topic._id,isActive:true}));if(req.user.role==='student'){delete data.selfAssessmentAnswer;data.selfAssessmentPassed=Boolean(await TopicGateAttempt.exists({studentId:req.user.userId,topicId:topic._id,passed:true}));}res.json({topic:data});});
app.post('/api/topics/:id/self-assessment',auth,role('student'),async(req,res)=>{const topic=await Topic.findById(req.params.id);if(!topic)return res.status(404).json({error:'Topic not found'});if(!await ownedSubject(topic.subjectId,req.user))return res.status(403).json({error:'You do not have access to this topic'});if(!String(topic.selfAssessmentPrompt||'').trim())return res.status(400).json({error:'This topic does not have a self-assessment yet'});const answer=String(req.body.answer||'');if(!['True','False'].includes(answer))return res.status(400).json({error:'Choose True or False'});const correct=answer===topic.selfAssessmentAnswer;const attempt=await TopicGateAttempt.findOneAndUpdate({studentId:req.user.userId,topicId:topic._id},{$set:{lastAnswer:answer},$inc:{attemptCount:1},$setOnInsert:{subjectId:topic.subjectId,passed:false}},{upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true});if(correct&&!attempt.passed){attempt.passed=true;await attempt.save();}const passed=attempt.passed;const message=passed?(correct?'Correct. The quiz is now unlocked.':'You already passed this check; the quiz remains unlocked.'):'Not quite. Review the lesson and try again.';res.json({passed,message});});
app.get('/api/topics/:id/file',auth,async(req,res)=>{const topic=await Topic.findById(req.params.id);if(!topic)return res.status(404).json({error:'Topic not found'});const subject=await ownedSubject(topic.subjectId,req.user);if(!subject)return res.status(403).json({error:'You do not have access to this topic'});if(req.user.role==='student'&&Number(topic.topicNumber)>1&&!await Score.exists({studentId:req.user.userId,subjectId:topic.subjectId,topicNumber:Number(topic.topicNumber)-1,passed:true}))return res.status(403).json({error:'Pass the previous topic quiz with at least 75% first.'});const extension=path.extname(topic.uploadedFileName||'').toLowerCase();if(!['.pdf','.ppt','.pptx'].includes(extension))return res.status(415).json({error:'Unsupported presentation format'});const disposition=extension==='.pdf'?'inline':`attachment; filename="${path.basename(topic.uploadedFileName||'presentation').replace(/"/g,'')}"`;if(topic.uploadedFileUrl?.startsWith('https://res.cloudinary.com/')){let remoteUrl;try{remoteUrl=new URL(topic.uploadedFileUrl);}catch{return res.status(502).json({error:'Uploaded presentation URL is invalid'});}if(remoteUrl.hostname!=='res.cloudinary.com')return res.status(502).json({error:'Uploaded presentation host is not supported'});let upstream;try{upstream=await fetch(remoteUrl);}catch(e){console.error('Unable to fetch topic presentation from Cloudinary:',e);return res.status(502).json({error:'Unable to retrieve uploaded presentation'});}if(!upstream.ok||!upstream.body){console.error(`Cloudinary topic presentation returned HTTP ${upstream.status}`);return res.status(502).json({error:'Unable to retrieve uploaded presentation'});}res.type(extension);res.set('Content-Disposition',disposition);const contentLength=upstream.headers.get('content-length');if(contentLength)res.set('Content-Length',contentLength);const stream=Readable.fromWeb(upstream.body);stream.on('error',e=>{console.error('Unable to stream topic presentation:',e);if(!res.headersSent)res.status(502).json({error:'Unable to stream uploaded presentation'});else res.destroy(e);});stream.pipe(res);return;}const storedName=topic.uploadedFileUrl?path.basename(topic.uploadedFileUrl):'';const filePath=storedName?path.join(uploadDir,storedName):'';if(!filePath||!fs.existsSync(filePath))return res.status(404).json({error:'Uploaded presentation file is missing from the server'});res.type(extension);res.set('Content-Disposition',disposition);res.sendFile(filePath);});
app.get('/api/topics/:id',auth,async(req,res)=>{const topic=await Topic.findById(req.params.id);if(!topic)return res.status(404).json({error:'Topic not found'});if(!await ownedSubject(topic.subjectId,req.user))return res.status(403).json({error:'You do not have access to this topic'});if(req.user.role==='student'&&Number(topic.topicNumber)>1&&!await Score.exists({studentId:req.user.userId,subjectId:topic.subjectId,topicNumber:Number(topic.topicNumber)-1,passed:true}))return res.status(403).json({error:'Pass the previous topic quiz with at least 75% first.'});const data=topic.toObject();data.quizAvailable=Boolean(await Quiz.exists({topicId:topic._id,isActive:true}));if(req.user.role==='student'){delete data.selfAssessmentAnswer;data.selfAssessmentPassed=Boolean(await TopicGateAttempt.exists({studentId:req.user.userId,topicId:topic._id,passed:true}));}res.json({topic:data});});
const validateTopicPayload=b=>{
  const limits={title:120,description:1000,richTextContent:150000,lessonContent:150000,summary:3000,summaryCard:3000,selfAssessmentPrompt:1000};
  for(const [key,limit] of Object.entries(limits)){
    if(b[key]!==undefined&&(typeof b[key]!=='string'||b[key].length>limit))return `${key} must be text with at most ${limit} characters`;
  }
  if(b.customSlides!==undefined&&(!Array.isArray(b.customSlides)||b.customSlides.length>50))return 'A topic can contain at most 50 custom slides';
  if(b.selfAssessmentAnswer!==undefined&&!['True','False'].includes(b.selfAssessmentAnswer))return 'Self-assessment answer must be True or False';
  if(b.isVerifiedComplete!==undefined&&typeof b.isVerifiedComplete!=='boolean')return 'Verified-complete status must be true or false';
  return '';
};
app.post('/api/topics',auth,role('faculty'),async(req,res)=>{const b=req.body;const validationError=validateTopicPayload(b);if(validationError)return res.status(400).json({error:validationError});const topicNumber=Number(b.topicNumber);if(!b.subjectId||!Number.isInteger(topicNumber)||topicNumber<1||!String(b.title||'').trim())return res.status(400).json({error:'A valid subject, positive topic number, and title are required'});if(!await ownedSubject(b.subjectId,req.user))return res.status(403).json({error:'Only the subject faculty can create its topics'});const payload={subjectId:b.subjectId,topicNumber,title:String(b.title).trim(),description:String(b.description||''),richTextContent:String(b.richTextContent||b.lessonContent||''),summary:String(b.summary||b.summaryCard||''),selfAssessmentPrompt:String(b.selfAssessmentPrompt||''),selfAssessmentAnswer:['True','False'].includes(b.selfAssessmentAnswer)?b.selfAssessmentAnswer:'True'};const topic=await Topic.findOneAndUpdate({subjectId:b.subjectId,topicNumber},{$set:payload},{upsert:true,new:true,runValidators:true,setDefaultsOnInsert:true});res.status(201).json({topic});});
app.put('/api/topics/:id',auth,role('faculty'),async(req,res)=>{const existing=await Topic.findById(req.params.id);if(!existing)return res.status(404).json({error:'Topic not found'});if(!await ownedSubject(existing.subjectId,req.user))return res.status(403).json({error:'Only the subject faculty can edit this topic'});const b=req.body;const validationError=validateTopicPayload(b);if(validationError)return res.status(400).json({error:validationError});const update={};['title','description','richTextContent','customSlides','summary','selfAssessmentPrompt','selfAssessmentAnswer','isVerifiedComplete','isActive'].forEach(key=>{if(b[key]!==undefined)update[key]=b[key];});if(b.lessonContent!==undefined)update.richTextContent=b.lessonContent;if(b.summaryCard!==undefined)update.summary=b.summaryCard;const topic=await Topic.findByIdAndUpdate(req.params.id,update,{new:true,runValidators:true});res.json({topic});});
app.post('/api/topics/:id/upload',auth,role('faculty'),upload.single('file'),async(req,res)=>{try{const existing=await Topic.findById(req.params.id);if(!existing)return res.status(404).json({error:'Topic not found'});const subject=await Subject.findOne({_id:existing.subjectId,facultyId:req.user.userId});if(!subject)return res.status(403).json({error:'Only the subject faculty can upload to this topic'});if(!req.file)return res.status(400).json({error:'File is required'});const extension=path.extname(req.file.originalname).toLowerCase();if(!['.pdf','.ppt','.pptx'].includes(extension))return res.status(400).json({error:'Only PDF, PPT, and PPTX files are allowed'});const uploadedFileUrl=await uploadToCloudinary(req.file,{folder:'group9/topic-files',resourceType:'raw'});const topic=await Topic.findByIdAndUpdate(existing._id,{uploadedFileUrl,uploadedFileName:req.file.originalname,pdfUrl:extension==='.pdf'?uploadedFileUrl:''},{new:true});res.status(201).json({topic});}catch(e){console.error(e);res.status(500).json({error:'Unable to upload topic file'});}});
app.get('/api/quizzes',auth,async(req,res)=>{
  const query={};
  if(req.query.subjectId){
    if(!await ownedSubject(req.query.subjectId,req.user))return res.status(403).json({error:'You do not have access to this subject'});
    query.subjectId=req.query.subjectId;
  }else{
    const subjectQuery=req.user.role==='faculty'?{facultyId:req.user.userId}:{enrolledStudents:req.user.userId};
    query.subjectId={$in:await Subject.distinct('_id',subjectQuery)};
  }
  if(req.query.topicId){
    const topic=await Topic.findById(req.query.topicId);
    if(!topic||!await ownedSubject(topic.subjectId,req.user))return res.status(403).json({error:'You do not have access to this topic'});
    query.topicId=topic._id;
  }
  const quizzes=await Quiz.find(query).sort({createdAt:-1});
  const availableQuizzes=req.user.role==='student'
    ?await Promise.all(quizzes.filter(quiz=>quiz.isActive).map(async quiz=>await studentCanAccessQuiz(quiz,req.user.userId)?studentQuiz(quiz):null))
    :quizzes;
  res.json({quizzes:req.user.role==='student'?availableQuizzes.filter(Boolean):availableQuizzes});
});
app.post('/api/quizzes/import',auth,role('faculty'),async(req,res)=>{
  const {subjectId,quizzes}=req.body;
  if(!Array.isArray(quizzes)||!quizzes.length||quizzes.length>100)return res.status(400).json({error:'Import between 1 and 100 quizzes at a time'});
  if(!await ownedSubject(subjectId,req.user))return res.status(403).json({error:'Only the subject faculty can import quizzes'});
  const prepared=[];
  for(const [index,item] of quizzes.entries()){
    if(!item||typeof item!=='object')return res.status(400).json({error:`Quiz ${index+1} must be an object`});
    const topicNumber=Number(item.topicNumber);
    if(!Number.isInteger(topicNumber)||topicNumber<1)return res.status(400).json({error:`Quiz ${index+1} has an invalid topic number`});
    const topic=await Topic.findOne({subjectId,topicNumber});
    if(!topic)return res.status(400).json({error:`Create Topic ${topicNumber} before importing its quiz`});
    if(!String(topic.selfAssessmentPrompt||'').trim())return res.status(400).json({error:`Add a True/False self-assessment to Topic ${topicNumber} before importing its quiz`});
    const payload={topicId:topic._id,subjectId,title:item.title,timeLimit:item.timeLimit===undefined?600:Number(item.timeLimit),passingScore:75,questions:item.questions,isActive:item.isActive!==false};
    const validationError=validateQuizPayload(payload);
    if(validationError)return res.status(400).json({error:`Quiz ${index+1}: ${validationError}`});
    prepared.push({topic,payload});
  }
  const imported=[];
  for(const {topic,payload} of prepared){
    const quiz=await Quiz.findOneAndUpdate({topicId:topic._id},{$set:payload},{new:true,upsert:true,runValidators:true,setDefaultsOnInsert:true});
    imported.push(quiz);
  }
  res.status(201).json({quizzes:imported,imported:imported.length});
});
app.get('/api/quizzes/:id',auth,async(req,res)=>{
  const quiz=await Quiz.findById(req.params.id);
  if(!quiz)return res.status(404).json({error:'Quiz not found'});
  if(!await ownedSubject(quiz.subjectId,req.user))return res.status(403).json({error:'You do not have access to this quiz'});
  if(req.user.role==='student'&&!quiz.isActive)return res.status(404).json({error:'Quiz not found'});
  if(req.user.role==='student'&&!await studentCanAccessQuiz(quiz,req.user.userId))return res.status(403).json({error:'Pass the previous topic quiz before viewing this quiz'});
  res.json({quiz:req.user.role==='student'?studentQuiz(quiz):quiz});
});
app.post('/api/quizzes/:id/start',auth,role('student'),async(req,res)=>{
  const quiz=await Quiz.findById(req.params.id);
  if(!quiz||!quiz.isActive)return res.status(404).json({error:'Quiz not found'});
  if(!await ownedSubject(quiz.subjectId,req.user))return res.status(403).json({error:'You do not have access to this quiz'});
  if(!await studentCanAccessQuiz(quiz,req.user.userId))return res.status(403).json({error:'Complete the topic True/False check and pass the previous topic first'});
  const duration=Number(quiz.timeLimit)||600;
  const latest=await QuizAttempt.findOne({studentId:req.user.userId,quizId:quiz._id,completedAt:null}).sort({startedAt:-1});
  const attempt=latest&&Date.now()-latest.startedAt.getTime()<=duration*1000+15000?latest:await QuizAttempt.create({studentId:req.user.userId,quizId:quiz._id,startedAt:new Date()});
  res.status(201).json({attemptId:attempt._id,startedAt:attempt.startedAt,timeLimit:duration});
});
app.post('/api/quizzes',auth,role('faculty'),async(req,res)=>{
  const validationError=validateQuizPayload(req.body);
  if(validationError)return res.status(400).json({error:validationError});
  const topic=await Topic.findOne({_id:req.body.topicId,subjectId:req.body.subjectId});
  if(!topic)return res.status(400).json({error:'The selected topic does not belong to this subject'});
  if(!await ownedSubject(req.body.subjectId,req.user))return res.status(403).json({error:'Only the subject faculty can create its quiz'});
  if(!String(topic.selfAssessmentPrompt||'').trim()||!['True','False'].includes(topic.selfAssessmentAnswer))return res.status(400).json({error:'Add a True/False self-assessment to this topic before creating its quiz'});
  const payload={...req.body,passingScore:75};
  delete payload._id;
  const quiz=await Quiz.findOneAndUpdate({topicId:topic._id},payload,{new:true,upsert:true,runValidators:true,setDefaultsOnInsert:true});
  res.status(201).json({quiz});
});
app.put('/api/quizzes/:id',auth,role('faculty'),async(req,res)=>{
  const validationError=validateQuizPayload(req.body);
  if(validationError)return res.status(400).json({error:validationError});
  const quiz=await Quiz.findById(req.params.id);
  if(!quiz)return res.status(404).json({error:'Quiz not found'});
  if(String(quiz.topicId)!==String(req.body.topicId)||String(quiz.subjectId)!==String(req.body.subjectId))return res.status(400).json({error:'Quiz topic and subject cannot be changed'});
  const topic=await Topic.findOne({_id:quiz.topicId,subjectId:quiz.subjectId});
  if(!topic)return res.status(400).json({error:'The selected topic does not belong to this subject'});
  if(!await ownedSubject(quiz.subjectId,req.user))return res.status(403).json({error:'Only the subject faculty can edit its quiz'});
  if(!String(topic.selfAssessmentPrompt||'').trim()||!['True','False'].includes(topic.selfAssessmentAnswer))return res.status(400).json({error:'Add a True/False self-assessment to this topic before saving its quiz'});
  const payload={...req.body,passingScore:75};
  delete payload._id;
  const updated=await Quiz.findByIdAndUpdate(quiz._id,payload,{new:true,runValidators:true});
  res.json({quiz:updated});
});
app.get('/api/scores',auth,async(req,res)=>{
  const query={};
  if(req.user.role==='student')query.studentId=req.user.userId;
  else if(req.query.subjectId){
    if(!await ownedSubject(req.query.subjectId,req.user))return res.status(403).json({error:'You do not have access to this subject'});
    query.subjectId=req.query.subjectId;
    if(req.query.studentId)query.studentId=req.query.studentId;
  }else query.subjectId={$in:await Subject.distinct('_id',{facultyId:req.user.userId})};
  if(req.query.subjectId&&req.user.role==='student')query.subjectId=req.query.subjectId;
  if(req.query.topicId)query.topicId=req.query.topicId;
  res.json({scores:await Score.find(query).populate('studentId','fullName studentId yearLevel section').populate('quizId','title').sort({topicNumber:1,createdAt:-1})});
});
app.post('/api/scores',auth,role('student'),async(req,res)=>{
  const quiz=await Quiz.findById(req.body.quizId);
  if(!quiz)return res.status(404).json({error:'Quiz not found'});
  if(!quiz.isActive)return res.status(400).json({error:'This quiz is not currently available'});
  if(!await ownedSubject(quiz.subjectId,req.user))return res.status(403).json({error:'You do not have access to this quiz'});
  const topic=await Topic.findOne({_id:quiz.topicId,subjectId:quiz.subjectId});
  if(!topic)return res.status(404).json({error:'Quiz topic not found'});
  const topicNumber=Number(topic.topicNumber);
  if(!await studentCanAccessQuiz(quiz,req.user.userId))return res.status(403).json({error:`Pass Topic ${topicNumber-1} before taking this quiz`});
  const attempt=await QuizAttempt.findOne({_id:req.body.attemptId,quizId:quiz._id,studentId:req.user.userId,completedAt:null});
  if(!attempt)return res.status(400).json({error:'Start a new quiz attempt before submitting'});
  const timeTaken=Math.max(0,Math.floor((Date.now()-attempt.startedAt.getTime())/1000));
  if(timeTaken>quiz.timeLimit+15)return res.status(400).json({error:'The quiz time expired. Start a new attempt to try again.'});
  let rawScore=0,totalPoints=0;
  const answers=[];
  for(const question of quiz.questions){
    const answer=String((req.body.answers||{})[question._id.toString()]||'').trim();
    const isCorrect=answer.toLowerCase()===String(question.correctAnswer||'').trim().toLowerCase();
    const points=Number(question.points)||1;
    totalPoints+=points;
    if(isCorrect)rawScore+=points;
    answers.push({questionId:question._id,answer,isCorrect});
  }
  if(!totalPoints)return res.status(400).json({error:'This quiz has no scorable questions'});
  const percentage=Math.round(rawScore/totalPoints*100);
  const passed=percentage>=75;
  const completedAt=new Date();
  const claimed=await QuizAttempt.findOneAndUpdate({_id:attempt._id,completedAt:null},{$set:{completedAt}},{new:true});
  if(!claimed)return res.status(409).json({error:'This quiz attempt has already been submitted'});
  const attemptNumber=await Score.countDocuments({studentId:req.user.userId,quizId:quiz._id})+1;
  let score;
  try{
    score=await Score.create({
      studentId:req.user.userId,quizId:quiz._id,topicId:topic._id,subjectId:quiz.subjectId,topicNumber,
      rawScore,totalPoints,percentage,passed,answers,timeTaken:Math.min(timeTaken,quiz.timeLimit),attemptNumber
    });
  }catch(error){
    await QuizAttempt.updateOne({_id:claimed._id,completedAt},{$unset:{completedAt:1}});
    throw error;
  }
  const nextTopic=await Topic.findOne({subjectId:quiz.subjectId,topicNumber:{$gt:topicNumber}}).sort({topicNumber:1}).select('topicNumber');
  const message=passed
    ?`Congratulations! You scored ${percentage}%. ${nextTopic?`Topic ${nextTopic.topicNumber} unlocked.`:'You completed the learning path.'}`
    :`Score ${percentage}% is below the 75% passing mark. Review the topic content and retry.`;
  res.status(201).json({score:{...score.toObject(),message}});
});
app.get('/api/scores/matrix',auth,role('faculty'),async(req,res)=>{
  const subjectId=req.query.subjectId;
  if(!subjectId)return res.status(400).json({error:'subjectId is required'});
  const subject=await Subject.findOne({_id:subjectId,facultyId:req.user.userId}).populate('enrolledStudents','fullName studentId');
  if(!subject)return res.status(403).json({error:'You do not have access to this subject'});
  const topics=await Topic.find({subjectId}).select('topicNumber title').sort({topicNumber:1});
  const scores=await Score.find({subjectId}).populate('studentId','fullName studentId').sort({createdAt:-1});
  const matrix=new Map();
  const passedTopics=new Map();
  for(const student of subject.enrolledStudents){
    const key=String(student._id);
    matrix.set(key,{studentName:student.fullName,studentId:student.studentId||'',scores:{},overall:0,status:'INCOMPLETE'});
    passedTopics.set(key,new Set());
  }
  for(const score of scores){
    const student=score.studentId;
    if(!student)continue;
    const key=String(student._id);
    if(!matrix.has(key)){
      matrix.set(key,{studentName:student.fullName,studentId:student.studentId||'',scores:{},overall:0,status:'INCOMPLETE'});
      passedTopics.set(key,new Set());
    }
    const row=matrix.get(key);
    row.scores[score.topicNumber]=Math.max(row.scores[score.topicNumber]||0,score.percentage);
    if(score.passed)passedTopics.get(key).add(Number(score.topicNumber));
  }
  const rows=[...matrix.entries()].map(([studentKey,row])=>{
    const values=topics.map(topic=>row.scores[topic.topicNumber]).filter(value=>typeof value==='number');
    row.overall=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0;
    row.status=topics.length>0&&topics.every(topic=>passedTopics.get(studentKey)?.has(Number(topic.topicNumber)))?'PASSED':'INCOMPLETE';
    return row;
  });
  res.json({matrix:rows,topics});
});
app.post('/api/uploads',auth,role('faculty'),upload.single('file'),async(req,res)=>{try{if(!req.file)return res.status(400).json({error:'File is required'});const url=await uploadToCloudinary(req.file,{folder:'group9/uploads',resourceType:'auto'});res.status(201).json({url,filename:req.file.originalname});}catch(e){console.error(e);res.status(500).json({error:'Unable to upload file'});}});
connectDb().then(()=>app.listen(port,()=>console.log(`GROUP9 API listening on ${port}`))).catch(error=>{console.error('Database connection failed:',error);process.exit(1);});
