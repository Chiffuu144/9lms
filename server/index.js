require('dotenv').config();
const express=require('express'); const cors=require('cors'); const cookieParser=require('cookie-parser'); const bcrypt=require('bcryptjs'); const jwt=require('jsonwebtoken'); const multer=require('multer'); const path=require('path'); const fs=require('fs');
const connectDb=require('./config/db'); const {User,Subject,Topic,Quiz,Score}=require('./models'); const {auth,role}=require('./middleware/auth');
const app=express(); const port=process.env.PORT||5000; const clientOrigin=process.env.CLIENT_URL||'http://localhost:5173';
app.use(cors({origin:clientOrigin,credentials:true})); app.use(express.json({limit:'2mb'})); app.use(cookieParser());
const uploadDir=path.join(__dirname,'uploads');fs.mkdirSync(uploadDir,{recursive:true});app.use('/uploads',express.static(uploadDir));const upload=multer({storage:multer.diskStorage({destination:uploadDir,filename:(req,file,callback)=>{const safeName=path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g,'-');callback(null,`${Date.now()}-${safeName}`);}}),limits:{fileSize:50*1024*1024}});
const topicAssetsDir=path.join(__dirname,'..','public','topics');
app.use('/topic-assets',express.static(topicAssetsDir));
const publicUser=u=>({id:u._id.toString(),email:u.email,fullName:u.fullName,role:u.role,studentId:u.studentId,facultyId:u.facultyId,yearLevel:u.yearLevel,section:u.section,department:u.department,profileImageUrl:u.profileImageUrl,profileImageName:u.profileImageName});
const generateStudentId=async()=>{let candidate;do{candidate=`TUP-STU-${new Date().getFullYear()}-${Math.floor(100000+Math.random()*900000)}`;}while(await User.exists({studentId:candidate}));return candidate;};
const generateFacultyId=async()=>{let candidate;do{candidate=`TUP-FAC-${new Date().getFullYear()}-${Math.floor(100000+Math.random()*900000)}`;}while(await User.exists({facultyId:candidate}));return candidate;};
const ensureStudentId=async user=>{if(user&&user.role==='student'&&!user.studentId){user.studentId=await generateStudentId();await user.save();}return user;};
const ensureFacultyId=async user=>{if(user&&user.role==='faculty'&&!user.facultyId){user.facultyId=await generateFacultyId();await user.save();}return user;};
app.get('/api/health',(req,res)=>res.json({ok:true}));
app.get('/api/topic-assets',auth,async(req,res)=>{
  const topicNum=String(req.query.topicNum||'');
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
        if(!topicNum||!match||match[1]===topicNum)entries.push({name:entry.name,path:nextRelative.split(path.sep).join('/'),extension,size:fs.statSync(absolute).size,url:`/topic-assets/${nextRelative.split(path.sep).join('/')}`});
      }
    }
  };
  walk(topicAssetsDir);
  res.json({assets:entries});
});
app.post('/api/auth/register',upload.single('profileImage'),async(req,res)=>{try{const b=req.body;if(!b.role||!b.fullName||!b.email||!b.password)return res.status(400).json({error:'Missing required fields'});if(!['student','faculty'].includes(b.role))return res.status(400).json({error:'Invalid role'});if(b.role==='student'&&(!b.yearLevel||!b.section))return res.status(400).json({error:'Year level and section are required for students'});if(b.role==='faculty'&&!b.department)return res.status(400).json({error:'Department is required for faculty'});if(await User.findOne({email:b.email.toLowerCase()}))return res.status(409).json({error:'Email already registered'});const profileImageUrl=req.file?`${process.env.PUBLIC_API_URL||`http://localhost:${port}`}/uploads/${req.file.filename}`:'';const studentId=b.role==='student'?await generateStudentId():undefined;const facultyId=b.role==='faculty'?await generateFacultyId():undefined;const u=await User.create({role:b.role,email:b.email.toLowerCase().trim(),fullName:b.fullName.trim(),password:await bcrypt.hash(b.password,12),studentId,yearLevel:b.yearLevel,section:b.section,facultyId,department:b.department,profileImageUrl,profileImageName:req.file?.originalname||''});res.status(201).json({success:true,user:publicUser(u)});}catch(e){console.error(e);res.status(500).json({error:'Internal server error'});}});
app.post('/api/auth/login',async(req,res)=>{try{const u=await User.findOne({email:(req.body.email||'').toLowerCase()});if(!u||!(await bcrypt.compare(req.body.password||'',u.password)))return res.status(401).json({error:'Invalid credentials'});await ensureStudentId(u);await ensureFacultyId(u);const token=jwt.sign({userId:u._id.toString(),email:u.email,role:u.role,fullName:u.fullName},process.env.JWT_SECRET||'group9-tup-secret-key-2024',{expiresIn:'7d'});res.cookie('auth-token',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:process.env.NODE_ENV==='production'?'none':'lax',maxAge:604800000});res.json({success:true,user:publicUser(u)});}catch(e){console.error(e);res.status(500).json({error:'Internal server error'});}});
app.post('/api/auth/logout',(req,res)=>{res.clearCookie('auth-token');res.json({success:true});});app.get('/api/auth/me',auth,async(req,res)=>{const user=await ensureFacultyId(await ensureStudentId(await User.findById(req.user.userId)));res.json({user:publicUser(user)});});
app.put('/api/auth/profile',auth,upload.single('profileImage'),async(req,res)=>{try{const update={};['fullName','yearLevel','section','department'].forEach(key=>{if(req.body[key]!==undefined)update[key]=String(req.body[key]).trim();});if(req.file){update.profileImageUrl=`${process.env.PUBLIC_API_URL||`http://localhost:${port}`}/uploads/${req.file.filename}`;update.profileImageName=req.file.originalname;}const user=await User.findByIdAndUpdate(req.user.userId,update,{new:true,runValidators:true});if(!user)return res.status(404).json({error:'User not found'});res.json({user:publicUser(user)});}catch(e){console.error(e);res.status(500).json({error:'Unable to update profile'});}});
app.get('/api/subjects',auth,async(req,res)=>{const q=req.user.role==='faculty'?{facultyId:req.user.userId}:{enrolledStudents:req.user.userId};res.json({subjects:await Subject.find(q).populate('facultyId','fullName email department').sort({createdAt:-1})});});
app.post('/api/subjects',auth,role('faculty'),async(req,res)=>{const {subjectCode,subjectName,term,yearLevel}=req.body;if(!subjectCode||!subjectName||!term||!yearLevel)return res.status(400).json({error:'All fields are required'});res.status(201).json({subject:await Subject.create({subjectCode,subjectName,term,yearLevel,facultyId:req.user.userId,enrolledStudents:[]})});});
app.get('/api/subjects/all',auth,async(req,res)=>res.json({subjects:await Subject.find().sort({createdAt:-1})}));
app.get('/api/subjects/:id',auth,async(req,res)=>{const subject=await Subject.findById(req.params.id).populate('facultyId','fullName email department');if(!subject)return res.status(404).json({error:'Subject not found'});res.json({subject});});
app.post('/api/subjects/:id/enroll',auth,role('student'),async(req,res)=>{const subject=await Subject.findByIdAndUpdate(req.params.id,{$addToSet:{enrolledStudents:req.user.userId}},{new:true}).populate('facultyId','fullName email department');if(!subject)return res.status(404).json({error:'Subject not found'});res.json({subject,message:'Successfully enrolled in subject'});});
app.patch('/api/subjects/:id',auth,role('faculty'),async(req,res)=>{const subject=await Subject.findOneAndUpdate({_id:req.params.id,facultyId:req.user.userId},{$set:req.body},{new:true,runValidators:true});if(!subject)return res.status(404).json({error:'Subject not found'});res.json({subject});});
app.delete('/api/subjects/:id',auth,role('faculty'),async(req,res)=>{const subject=await Subject.findOneAndDelete({_id:req.params.id,facultyId:req.user.userId});if(!subject)return res.status(404).json({error:'Subject not found'});await Topic.deleteMany({subjectId:subject._id});await Quiz.deleteMany({subjectId:subject._id});await Score.deleteMany({subjectId:subject._id});res.json({success:true});});
app.get('/api/topics',auth,async(req,res)=>res.json({topics:await Topic.find(req.query.subjectId?{subjectId:req.query.subjectId}:{}).sort({topicNumber:1})}));
app.get('/api/topics/access',auth,async(req,res)=>{const topicNumber=Number(req.query.topicNumber||1);if(req.user.role==='faculty'||topicNumber<=1)return res.json({allowed:true});const allowed=Boolean(await Score.exists({studentId:req.user.userId,subjectId:req.query.subjectId,topicNumber:topicNumber-1,passed:true}));res.json({allowed,reason:allowed?'':'Pass the previous topic quiz with at least 75% first.'});});
const ownedSubject=async(subjectId,user)=>user.role==='faculty'?Subject.findOne({_id:subjectId,facultyId:user.userId}):Subject.findOne({_id:subjectId,enrolledStudents:user.userId});
const validateQuizPayload=quiz=>{
  if(!quiz.topicId||!quiz.subjectId||!String(quiz.title||'').trim()||!Array.isArray(quiz.questions)||quiz.questions.length<1)return 'A topic, title, and at least one question are required';
  if(quiz.questions.length>20)return 'Maximum 20 questions per quiz';
  const timeLimit=Number(quiz.timeLimit);
  const passingScore=Number(quiz.passingScore);
  if(!Number.isInteger(timeLimit)||timeLimit<60||timeLimit>10800)return 'Time limit must be between 1 and 180 minutes';
  if(!Number.isFinite(passingScore)||passingScore<1||passingScore>100)return 'Passing score must be between 1 and 100';
  for(const [index,question] of quiz.questions.entries()){
    const type=question.type;
    const answer=String(question.correctAnswer||'').trim();
    const points=Number(question.points||1);
    if(!['multiple_choice','true_false','identification'].includes(type)||!String(question.questionText||'').trim()||!answer)return `Question ${index+1} is incomplete`;
    if(!Number.isFinite(points)||points<=0)return `Question ${index+1} must have a positive point value`;
    if(type==='multiple_choice'){
      const choices=(question.choices||[]).map(choice=>String(choice||'').trim()).filter(Boolean);
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
  const topic=await Topic.findOne({_id:quiz.topicId,subjectId:quiz.subjectId}).select('topicNumber');
  if(!topic)return false;
  return Number(topic.topicNumber)<=1||Boolean(await Score.exists({
    studentId,subjectId:quiz.subjectId,topicNumber:Number(topic.topicNumber)-1,passed:true
  }));
};
app.get('/api/topics/subject/:subjectId/topic/:topicNumber',auth,async(req,res)=>{const subject=await ownedSubject(req.params.subjectId,req.user);if(!subject)return res.status(403).json({error:'You do not have access to this subject'});const topic=await Topic.findOne({subjectId:req.params.subjectId,topicNumber:Number(req.params.topicNumber)});if(!topic)return res.status(404).json({error:'Topic content not found'});if(req.user.role==='student'&&Number(req.params.topicNumber)>1&&!await Score.exists({studentId:req.user.userId,subjectId:req.params.subjectId,topicNumber:Number(req.params.topicNumber)-1,passed:true}))return res.status(403).json({error:'Pass the previous topic quiz with at least 75% first.'});res.json({topic});});
app.get('/api/topics/:id/file',auth,async(req,res)=>{const topic=await Topic.findById(req.params.id);if(!topic)return res.status(404).json({error:'Topic not found'});const subject=await ownedSubject(topic.subjectId,req.user);if(!subject)return res.status(403).json({error:'You do not have access to this topic'});const storedName=topic.uploadedFileUrl?path.basename(new URL(topic.uploadedFileUrl).pathname):'';const filePath=storedName?path.join(uploadDir,storedName):'';if(!filePath||!fs.existsSync(filePath))return res.status(404).json({error:'Uploaded presentation file is missing from the server'});const extension=path.extname(topic.uploadedFileName||storedName).toLowerCase();if(!['.pdf','.ppt','.pptx'].includes(extension))return res.status(415).json({error:'Unsupported presentation format'});res.type(extension);res.set('Content-Disposition',extension==='.pdf'?'inline':`attachment; filename="${path.basename(topic.uploadedFileName||storedName).replace(/"/g,'')}"`);res.sendFile(filePath);});
app.get('/api/topics/:id',auth,async(req,res)=>{const topic=await Topic.findById(req.params.id);if(!topic)return res.status(404).json({error:'Topic not found'});res.json({topic});});
app.post('/api/topics',auth,role('faculty'),async(req,res)=>{const b=req.body;const topic=await Topic.findOneAndUpdate({subjectId:b.subjectId,topicNumber:b.topicNumber},b,{upsert:true,new:true,setDefaultsOnInsert:true});res.status(201).json({topic});});
app.put('/api/topics/:id',auth,role('faculty'),async(req,res)=>{const existing=await Topic.findById(req.params.id);if(!existing)return res.status(404).json({error:'Topic not found'});const subject=await Subject.findOne({_id:existing.subjectId,facultyId:req.user.userId});if(!subject)return res.status(403).json({error:'Only the subject faculty can edit this topic'});const b=req.body;const update={};['title','description','richTextContent','uploadedFileUrl','uploadedFileName','customSlides','summary','isVerifiedComplete','isActive'].forEach(key=>{if(b[key]!==undefined)update[key]=b[key];});if(b.lessonContent!==undefined)update.richTextContent=b.lessonContent;if(b.summaryCard!==undefined)update.summary=b.summaryCard;const topic=await Topic.findByIdAndUpdate(req.params.id,update,{new:true,runValidators:true});res.json({topic});});
app.post('/api/topics/:id/upload',auth,role('faculty'),upload.single('file'),async(req,res)=>{const existing=await Topic.findById(req.params.id);if(!existing)return res.status(404).json({error:'Topic not found'});const subject=await Subject.findOne({_id:existing.subjectId,facultyId:req.user.userId});if(!subject)return res.status(403).json({error:'Only the subject faculty can upload to this topic'});if(!req.file)return res.status(400).json({error:'File is required'});const extension=path.extname(req.file.originalname).toLowerCase();if(!['.pdf','.ppt','.pptx'].includes(extension)){fs.unlinkSync(req.file.path);return res.status(400).json({error:'Only PDF, PPT, and PPTX files are allowed'});}const uploadedFileUrl=`${process.env.PUBLIC_API_URL||`http://localhost:${port}`}/uploads/${req.file.filename}`;const topic=await Topic.findByIdAndUpdate(existing._id,{uploadedFileUrl,uploadedFileName:req.file.originalname,pdfUrl:extension==='.pdf'?uploadedFileUrl:''},{new:true});res.status(201).json({topic});});
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
app.get('/api/quizzes/:id',auth,async(req,res)=>{
  const quiz=await Quiz.findById(req.params.id);
  if(!quiz)return res.status(404).json({error:'Quiz not found'});
  if(!await ownedSubject(quiz.subjectId,req.user))return res.status(403).json({error:'You do not have access to this quiz'});
  if(req.user.role==='student'&&!quiz.isActive)return res.status(404).json({error:'Quiz not found'});
  if(req.user.role==='student'&&!await studentCanAccessQuiz(quiz,req.user.userId))return res.status(403).json({error:'Pass the previous topic quiz before viewing this quiz'});
  res.json({quiz:req.user.role==='student'?studentQuiz(quiz):quiz});
});
app.post('/api/quizzes',auth,role('faculty'),async(req,res)=>{
  const validationError=validateQuizPayload(req.body);
  if(validationError)return res.status(400).json({error:validationError});
  const topic=await Topic.findOne({_id:req.body.topicId,subjectId:req.body.subjectId});
  if(!topic)return res.status(400).json({error:'The selected topic does not belong to this subject'});
  if(!await ownedSubject(req.body.subjectId,req.user))return res.status(403).json({error:'Only the subject faculty can create its quiz'});
  const payload={...req.body};
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
  const payload={...req.body};
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
  const passed=percentage>=quiz.passingScore;
  const attemptNumber=await Score.countDocuments({studentId:req.user.userId,quizId:quiz._id})+1;
  const score=await Score.create({
    studentId:req.user.userId,quizId:quiz._id,topicId:topic._id,subjectId:quiz.subjectId,topicNumber,
    rawScore,totalPoints,percentage,passed,answers,timeTaken:Math.max(0,Number(req.body.timeTaken)||0),attemptNumber
  });
  const message=passed
    ?`Congratulations! You scored ${percentage}%. ${topicNumber<6?`Topic ${topicNumber+1} unlocked.`:'You completed the learning path.'}`
    :`Score ${percentage}% is below the ${quiz.passingScore}% passing mark. Review the topic content and retry.`;
  res.status(201).json({score:{...score.toObject(),message}});
});
app.get('/api/scores/matrix',auth,role('faculty'),async(req,res)=>{
  const subjectId=req.query.subjectId;
  if(!subjectId)return res.status(400).json({error:'subjectId is required'});
  const subject=await Subject.findOne({_id:subjectId,facultyId:req.user.userId}).populate('enrolledStudents','fullName studentId');
  if(!subject)return res.status(403).json({error:'You do not have access to this subject'});
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
    const values=[1,2,3,4,5,6].map(number=>row.scores[number]).filter(value=>typeof value==='number');
    row.overall=values.length?Math.round(values.reduce((a,b)=>a+b,0)/6):0;
    row.status=passedTopics.get(studentKey)?.size===6?'PASSED':'INCOMPLETE';
    return row;
  });
  res.json({matrix:rows});
});
app.post('/api/uploads',auth,role('faculty'),upload.single('file'),(req,res)=>{if(!req.file)return res.status(400).json({error:'File is required'});res.status(201).json({url:`${process.env.PUBLIC_API_URL||`http://localhost:${port}`}/uploads/${req.file.filename}`,filename:req.file.originalname});});
connectDb().then(()=>app.listen(port,()=>console.log(`GROUP9 API listening on ${port}`))).catch(error=>{console.error('Database connection failed:',error);process.exit(1);});
