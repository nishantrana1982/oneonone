"use strict";(()=>{var e={};e.id=8451,e.ids=[8451],e.modules={53524:e=>{e.exports=require("@prisma/client")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},27790:e=>{e.exports=require("assert")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},17702:e=>{e.exports=require("events")},32615:e=>{e.exports=require("http")},35240:e=>{e.exports=require("https")},19801:e=>{e.exports=require("os")},55315:e=>{e.exports=require("path")},86624:e=>{e.exports=require("querystring")},17360:e=>{e.exports=require("url")},21764:e=>{e.exports=require("util")},71568:e=>{e.exports=require("zlib")},93977:e=>{e.exports=require("node:fs/promises")},36703:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>S,patchFetch:()=>E,requestAsyncStorage:()=>w,routeModule:()=>y,serverHooks:()=>f,staticGenerationAsyncStorage:()=>h});var n={};r.r(n),r.d(n,{POST:()=>m});var s=r(49303),o=r(88716),i=r(60670),a=r(87070),c=r(21910),l=r(72331),d=r(94648),p=r(99678),u=r(53524);async function m(e,{params:t}){try{let r=await (0,c.MH)([u.UserRole.REPORTER,u.UserRole.SUPER_ADMIN]),{key:n,duration:s}=await e.json(),o=await l._.meeting.findUnique({where:{id:t.id},include:{employee:!0,reporter:!0}});if(!o)return a.NextResponse.json({error:"Meeting not found"},{status:404});if(!(0,c.sm)(r.role,r.id,o.employeeId,o.employee.reportsToId))return a.NextResponse.json({error:"Unauthorized"},{status:403});let i=await l._.meetingRecording.update({where:{meetingId:t.id},data:{status:"UPLOADED",audioUrl:`https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${n}`}});return g(t.id,n,o.employee.name,o.reporter.name,r.id).catch(e=>console.error("Background processing error:",e)),a.NextResponse.json({message:"Processing started",recordingId:i.id})}catch(e){return console.error("Error processing recording:",e),a.NextResponse.json({error:"Failed to process recording"},{status:500})}}async function g(e,t,r,n,s){try{await l._.meetingRecording.update({where:{meetingId:e},data:{status:"TRANSCRIBING"}});let o=await (0,d.vw)(t),i=await fetch(o);if(!i.ok)throw Error("Failed to download audio file");let a=Buffer.from(await i.arrayBuffer()),c=await (0,p.KR)(a,"recording.webm");await l._.meetingRecording.update({where:{meetingId:e},data:{transcript:c.text,language:c.language,duration:Math.round(c.duration),status:"ANALYZING"}});let u=await (0,p.cL)(c.text,r,n);await l._.meetingRecording.update({where:{meetingId:e},data:{summary:u.summary,keyPoints:u.keyPoints,autoTodos:u.suggestedTodos,sentiment:u.sentiment,qualityScore:u.qualityScore,qualityDetails:u.qualityDetails,status:"COMPLETED",processedAt:new Date}});let m=await l._.meeting.findUnique({where:{id:e},include:{employee:!0,reporter:!0}});if(m&&u.suggestedTodos.length>0)for(let t of u.suggestedTodos){let r="employee"===t.assignTo?m.employeeId:m.reporterId;await l._.todo.create({data:{meetingId:e,title:`[Auto] ${t.title}`,description:t.description,priority:t.priority,assignedToId:r,createdById:s}})}}catch(t){console.error("Processing error:",t),await l._.meetingRecording.update({where:{meetingId:e},data:{status:"FAILED",errorMessage:t instanceof Error?t.message:"Unknown error"}})}}let y=new s.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/meetings/[id]/recording/process/route",pathname:"/api/meetings/[id]/recording/process",filename:"route",bundlePath:"app/api/meetings/[id]/recording/process/route"},resolvedPagePath:"/Users/nishantrana/Library/Mobile Documents/com~apple~CloudDocs/Cursor/AMI One on One/app/api/meetings/[id]/recording/process/route.ts",nextConfigOutput:"standalone",userland:n}),{requestAsyncStorage:w,staticGenerationAsyncStorage:h,serverHooks:f}=y,S="/api/meetings/[id]/recording/process/route";function E(){return(0,i.patchFetch)({serverHooks:f,staticGenerationAsyncStorage:h})}},21910:(e,t,r)=>{r.d(t,{MH:()=>l,kF:()=>d,mk:()=>c,sm:()=>p,ts:()=>a});var n=r(75571),s=r(90455),o=r(53524),i=r(58585);async function a(){let e=await (0,n.getServerSession)(s.L);return e?.user||null}async function c(){let e=await a();return e||(0,i.redirect)("/auth/signin"),e}async function l(e){let t=await c();return e.includes(t.role)||(0,i.redirect)("/dashboard"),t}async function d(){return l([o.UserRole.SUPER_ADMIN])}function p(e,t,r,n){return e===o.UserRole.SUPER_ADMIN||t===r||e===o.UserRole.REPORTER&&n===t}},90455:(e,t,r)=>{r.d(t,{L:()=>i});var n=r(77234),s=r(13539),o=r(72331);let i={adapter:(0,s.N)(o._),providers:[(0,n.Z)({clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET,authorization:{params:{prompt:"consent",access_type:"offline",response_type:"code",scope:"openid email profile https://www.googleapis.com/auth/calendar"}}})],callbacks:{async signIn({user:e,account:t,profile:r}){let n=process.env.GOOGLE_WORKSPACE_DOMAIN;if(!n)return console.warn("GOOGLE_WORKSPACE_DOMAIN not set, allowing all domains"),!0;let s=e.email||r?.email;return!!s&&s.split("@")[1]===n},async session({session:e,user:t}){if(e.user){let r=await o._.user.findUnique({where:{email:t.email},select:{id:!0,role:!0,name:!0,email:!0,avatar:!0,departmentId:!0,reportsToId:!0}});r&&(e.user.id=r.id,e.user.role=r.role,e.user.departmentId=r.departmentId,e.user.reportsToId=r.reportsToId)}return e},jwt:async({token:e,account:t,user:r})=>(t&&r&&(e.accessToken=t.access_token,e.refreshToken=t.refresh_token),e)},pages:{signIn:"/auth/signin",error:"/auth/error"},session:{strategy:"database",maxAge:2592e3}}},36494:(e,t,r)=>{r.d(t,{HI:()=>a,pe:()=>c,xG:()=>l});var n=r(84770),s=r.n(n);let o="aes-256-gcm";function i(){let e=process.env.NEXTAUTH_SECRET||process.env.ENCRYPTION_SECRET;if(!e)throw Error("NEXTAUTH_SECRET or ENCRYPTION_SECRET must be set for encryption");return s().scryptSync(e,"salt",32)}function a(e){let t=i(),r=s().randomBytes(16),n=s().createCipheriv(o,t,r),a=n.update(e,"utf8","hex");a+=n.final("hex");let c=n.getAuthTag();return r.toString("hex")+":"+c.toString("hex")+":"+a}function c(e){let t=i(),r=e.split(":");if(3!==r.length)throw Error("Invalid encrypted text format");let n=Buffer.from(r[0],"hex"),a=Buffer.from(r[1],"hex"),c=r[2],l=s().createDecipheriv(o,t,n);return l.setAuthTag(a),l.update(c,"hex","utf8")+l.final("utf8")}function l(e){return e?e.length<=8?"****":e.substring(0,4)+"****"+e.substring(e.length-4):""}},99678:(e,t,r)=>{r.d(t,{KR:()=>a,cL:()=>c,e1:()=>d,rV:()=>l});var n=r(91088),s=r(51809);async function o(){let e=await (0,s.Gw)();if(!e.openaiApiKey)throw Error("OpenAI API key not configured. Please configure it in Admin > Settings.");return new n.default({apiKey:e.openaiApiKey})}async function i(){let e=await (0,s.Gw)();return{gptModel:e.openaiModel||"gpt-4o",whisperModel:e.whisperModel||"whisper-1"}}async function a(e,t){let r=await o(),n=await i(),s=new File([e],t,{type:"audio/webm"}),a=await r.audio.transcriptions.create({file:s,model:n.whisperModel,response_format:"verbose_json"});return{text:a.text,language:a.language||"en",duration:a.duration||0}}async function c(e,t,r){let n=`You are an expert at analyzing one-on-one meeting transcripts. 
Your task is to extract insights, action items, and assess meeting quality.
The transcript may be in English, Hindi, or Gujarati. Provide analysis in English.

Employee: ${t}
Reporter/Manager: ${r}

Analyze the transcript and provide:
1. A concise summary (2-3 sentences)
2. Key points discussed (bullet points)
3. Suggested action items/todos with assignee and priority
4. Sentiment analysis
5. Meeting quality score and detailed breakdown

Be thorough but concise. Focus on actionable insights.`,s=`Analyze this one-on-one meeting transcript:

---
${e}
---

Provide your analysis in the following JSON format:
{
  "summary": "Brief 2-3 sentence summary",
  "keyPoints": ["point 1", "point 2", ...],
  "suggestedTodos": [
    {
      "title": "Task title",
      "description": "Brief description",
      "assignTo": "employee" or "reporter",
      "priority": "HIGH", "MEDIUM", or "LOW"
    }
  ],
  "sentiment": {
    "score": number between -1 and 1,
    "label": "positive", "neutral", or "negative",
    "employeeMood": "description of employee's mood/attitude",
    "reporterEngagement": "description of reporter's engagement",
    "overallTone": "description of overall meeting tone"
  },
  "qualityScore": number between 1-100,
  "qualityDetails": {
    "clarity": number 1-10,
    "actionability": number 1-10,
    "engagement": number 1-10,
    "goalAlignment": number 1-10,
    "followUp": number 1-10,
    "overallFeedback": "brief feedback on meeting quality"
  },
  "commonThemes": ["theme1", "theme2", ...]
}

Only respond with valid JSON, no additional text.`,a=await o(),c=await i(),l=(await a.chat.completions.create({model:c.gptModel,messages:[{role:"system",content:n},{role:"user",content:s}],temperature:.3,response_format:{type:"json_object"}})).choices[0].message.content;if(!l)throw Error("No response from OpenAI");return JSON.parse(l)}async function l(e,t){let r=`You are a search assistant. Given a search query and a list of meeting transcripts, 
find the most relevant transcripts and return their IDs with relevance scores and relevant snippets.
Transcripts may be in English, Hindi, or Gujarati. Search across all languages.`,n=`Search query: "${t}"

Transcripts:
${e.map((e,t)=>`[${t}] ID: ${e.id}, Meeting: ${e.meetingId}
${e.text.slice(0,500)}...`).join("\n\n")}

Return results as JSON array:
[
  {
    "index": number,
    "relevance": number 0-100,
    "snippet": "relevant excerpt from transcript"
  }
]
Only include transcripts with relevance > 30. Sort by relevance descending.`,s=await o(),i=(await s.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"system",content:r},{role:"user",content:n}],temperature:.1,response_format:{type:"json_object"}})).choices[0].message.content;if(!i)return[];let a=JSON.parse(i);return(a.results||a||[]).map(t=>({id:e[t.index]?.id,meetingId:e[t.index]?.meetingId,relevance:t.relevance,snippet:t.snippet})).filter(e=>e.id)}async function d(e){let t=`You are an organizational analyst. Analyze aggregated one-on-one meeting data 
to provide organization-wide insights, identify common issues, and make recommendations.`,r=`Analyze these aggregated meeting summaries from across the organization:

${JSON.stringify(e,null,2)}

Provide organization-wide insights in JSON format:
{
  "overallScore": number 1-100,
  "topIssues": ["issue1", "issue2", ...] (max 5),
  "topStrengths": ["strength1", "strength2", ...] (max 5),
  "departmentScores": { "dept1": score, "dept2": score, ... },
  "recommendations": ["recommendation1", "recommendation2", ...] (max 5),
  "trendAnalysis": "Brief analysis of trends and patterns"
}

Only respond with valid JSON.`,n=await o(),s=await i(),a=(await n.chat.completions.create({model:s.gptModel,messages:[{role:"system",content:t},{role:"user",content:r}],temperature:.3,response_format:{type:"json_object"}})).choices[0].message.content;if(!a)throw Error("No response from OpenAI");return JSON.parse(a)}},72331:(e,t,r)=>{r.d(t,{_:()=>s});var n=r(53524);let s=globalThis.prisma??new n.PrismaClient({log:["error"]})},94648:(e,t,r)=>{r.d(t,{ED:()=>l,Ai:()=>d,vw:()=>c,Rh:()=>a});let n=require("@aws-sdk/client-s3");var s=r(7864),o=r(51809);async function i(){let e=await (0,o.Gw)(),t=e.awsRegion||process.env.AWS_REGION||"us-east-1",r=e.awsAccessKeyId||process.env.AWS_ACCESS_KEY_ID||"",s=e.awsSecretKey||process.env.AWS_SECRET_ACCESS_KEY||"",i=e.awsS3Bucket||process.env.AWS_S3_BUCKET||"ami-one-on-one-recordings";return{client:new n.S3Client({region:t,credentials:{accessKeyId:r,secretAccessKey:s}}),bucket:i,region:t}}async function a(e,t,r=3600){let{client:o,bucket:a}=await i(),c=new n.PutObjectCommand({Bucket:a,Key:e,ContentType:t});return{uploadUrl:await (0,s.e)(o,c,{expiresIn:r}),key:e}}async function c(e,t=3600){let{client:r,bucket:o}=await i(),a=new n.GetObjectCommand({Bucket:o,Key:e});return(0,s.e)(r,a,{expiresIn:t})}async function l(e){let{client:t,bucket:r}=await i(),s=new n.DeleteObjectCommand({Bucket:r,Key:e});await t.send(s)}function d(e){let t=Date.now();return`recordings/${e}/${t}.webm`}},51809:(e,t,r)=>{r.d(t,{Gw:()=>a,VP:()=>c});var n=r(72331),s=r(36494);let o=null,i=0;async function a(){if(o&&Date.now()-i<3e5)return o;let e=await n._.systemSettings.findUnique({where:{id:"system"}});if(!e)return{openaiApiKey:process.env.OPENAI_API_KEY||null,openaiModel:"gpt-4o",whisperModel:"whisper-1",awsRegion:process.env.AWS_REGION||null,awsAccessKeyId:process.env.AWS_ACCESS_KEY_ID||null,awsSecretKey:process.env.AWS_SECRET_ACCESS_KEY||null,awsS3Bucket:process.env.AWS_S3_BUCKET||null,maxRecordingMins:25};let t={openaiApiKey:e.openaiApiKey?(0,s.pe)(e.openaiApiKey):process.env.OPENAI_API_KEY||null,openaiModel:e.openaiModel,whisperModel:e.whisperModel,awsRegion:e.awsRegion||process.env.AWS_REGION||null,awsAccessKeyId:e.awsAccessKeyId||process.env.AWS_ACCESS_KEY_ID||null,awsSecretKey:e.awsSecretKey?(0,s.pe)(e.awsSecretKey):process.env.AWS_SECRET_ACCESS_KEY||null,awsS3Bucket:e.awsS3Bucket||process.env.AWS_S3_BUCKET||null,maxRecordingMins:e.maxRecordingMins};return o=t,i=Date.now(),t}async function c(e){let t={};return void 0!==e.openaiApiKey&&(t.openaiApiKey=e.openaiApiKey?(0,s.HI)(e.openaiApiKey):null),void 0!==e.openaiModel&&(t.openaiModel=e.openaiModel),void 0!==e.whisperModel&&(t.whisperModel=e.whisperModel),void 0!==e.awsRegion&&(t.awsRegion=e.awsRegion),void 0!==e.awsAccessKeyId&&(t.awsAccessKeyId=e.awsAccessKeyId),void 0!==e.awsSecretKey&&(t.awsSecretKey=e.awsSecretKey?(0,s.HI)(e.awsSecretKey):null),void 0!==e.awsS3Bucket&&(t.awsS3Bucket=e.awsS3Bucket),void 0!==e.maxRecordingMins&&(t.maxRecordingMins=e.maxRecordingMins),await n._.systemSettings.upsert({where:{id:"system"},create:{id:"system",...t},update:t}),o=null,i=0,a()}}};var t=require("../../../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[9276,8966,5972,1088,5962,816],()=>r(36703));module.exports=n})();