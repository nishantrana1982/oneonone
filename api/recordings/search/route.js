"use strict";(()=>{var e={};e.id=2574,e.ids=[2574],e.modules={53524:e=>{e.exports=require("@prisma/client")},72934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},27790:e=>{e.exports=require("assert")},78893:e=>{e.exports=require("buffer")},84770:e=>{e.exports=require("crypto")},17702:e=>{e.exports=require("events")},32615:e=>{e.exports=require("http")},35240:e=>{e.exports=require("https")},86624:e=>{e.exports=require("querystring")},17360:e=>{e.exports=require("url")},21764:e=>{e.exports=require("util")},71568:e=>{e.exports=require("zlib")},56398:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>h,patchFetch:()=>w,requestAsyncStorage:()=>f,routeModule:()=>m,serverHooks:()=>y,staticGenerationAsyncStorage:()=>g});var n={};r.r(n),r.d(n,{GET:()=>p});var o=r(49303),i=r(88716),s=r(60670),a=r(87070),c=r(21910),u=r(72331),l=r(99678),d=r(53524);async function p(e){try{let t=await (0,c.MH)([d.UserRole.REPORTER,d.UserRole.SUPER_ADMIN]),{searchParams:r}=new URL(e.url),n=r.get("q"),o=r.get("departmentId"),i=parseInt(r.get("limit")||"20");if(!n)return a.NextResponse.json({error:"Search query required"},{status:400});let s={recording:{status:"COMPLETED",transcript:{not:null}}};t.role===d.UserRole.REPORTER&&(s.reporterId=t.id),o&&(s.employee={departmentId:o});let p=await u._.meeting.findMany({where:s,include:{employee:{include:{department:!0}},reporter:!0,recording:!0},orderBy:{meetingDate:"desc"},take:100}),m=p.filter(e=>e.recording?.transcript).map(e=>({id:e.recording.id,meetingId:e.id,text:e.recording.transcript}));if(0===m.length)return a.NextResponse.json({results:[]});let f=(await (0,l.rV)(m,n)).slice(0,i).map(e=>{let t=p.find(t=>t.id===e.meetingId);return{...e,meeting:t?{id:t.id,date:t.meetingDate,employee:{id:t.employee.id,name:t.employee.name,department:t.employee.department?.name},reporter:{id:t.reporter.id,name:t.reporter.name}}:null}});return a.NextResponse.json({results:f})}catch(e){return console.error("Error searching recordings:",e),a.NextResponse.json({error:"Failed to search recordings"},{status:500})}}let m=new o.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/recordings/search/route",pathname:"/api/recordings/search",filename:"route",bundlePath:"app/api/recordings/search/route"},resolvedPagePath:"/Users/nishantrana/Library/Mobile Documents/com~apple~CloudDocs/Cursor/AMI One on One/app/api/recordings/search/route.ts",nextConfigOutput:"standalone",userland:n}),{requestAsyncStorage:f,staticGenerationAsyncStorage:g,serverHooks:y}=m,h="/api/recordings/search/route";function w(){return(0,s.patchFetch)({serverHooks:y,staticGenerationAsyncStorage:g})}},21910:(e,t,r)=>{r.d(t,{MH:()=>u,kF:()=>l,mk:()=>c,sm:()=>d,ts:()=>a});var n=r(75571),o=r(90455),i=r(53524),s=r(58585);async function a(){let e=await (0,n.getServerSession)(o.L);return e?.user||null}async function c(){let e=await a();return e||(0,s.redirect)("/auth/signin"),e}async function u(e){let t=await c();return e.includes(t.role)||(0,s.redirect)("/dashboard"),t}async function l(){return u([i.UserRole.SUPER_ADMIN])}function d(e,t,r,n){return e===i.UserRole.SUPER_ADMIN||t===r||e===i.UserRole.REPORTER&&n===t}},90455:(e,t,r)=>{r.d(t,{L:()=>s});var n=r(77234),o=r(13539),i=r(72331);let s={adapter:(0,o.N)(i._),providers:[(0,n.Z)({clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET,authorization:{params:{prompt:"consent",access_type:"offline",response_type:"code",scope:"openid email profile https://www.googleapis.com/auth/calendar"}}})],callbacks:{async signIn({user:e,account:t,profile:r}){let n=process.env.GOOGLE_WORKSPACE_DOMAIN;if(!n)return console.warn("GOOGLE_WORKSPACE_DOMAIN not set, allowing all domains"),!0;let o=e.email||r?.email;return!!o&&o.split("@")[1]===n},async session({session:e,user:t}){if(e.user){let r=await i._.user.findUnique({where:{email:t.email},select:{id:!0,role:!0,name:!0,email:!0,avatar:!0,departmentId:!0,reportsToId:!0}});r&&(e.user.id=r.id,e.user.role=r.role,e.user.departmentId=r.departmentId,e.user.reportsToId=r.reportsToId)}return e},jwt:async({token:e,account:t,user:r})=>(t&&r&&(e.accessToken=t.access_token,e.refreshToken=t.refresh_token),e)},pages:{signIn:"/auth/signin",error:"/auth/error"},session:{strategy:"database",maxAge:2592e3}}},36494:(e,t,r)=>{r.d(t,{HI:()=>a,pe:()=>c,xG:()=>u});var n=r(84770),o=r.n(n);let i="aes-256-gcm";function s(){let e=process.env.NEXTAUTH_SECRET||process.env.ENCRYPTION_SECRET;if(!e)throw Error("NEXTAUTH_SECRET or ENCRYPTION_SECRET must be set for encryption");return o().scryptSync(e,"salt",32)}function a(e){let t=s(),r=o().randomBytes(16),n=o().createCipheriv(i,t,r),a=n.update(e,"utf8","hex");a+=n.final("hex");let c=n.getAuthTag();return r.toString("hex")+":"+c.toString("hex")+":"+a}function c(e){let t=s(),r=e.split(":");if(3!==r.length)throw Error("Invalid encrypted text format");let n=Buffer.from(r[0],"hex"),a=Buffer.from(r[1],"hex"),c=r[2],u=o().createDecipheriv(i,t,n);return u.setAuthTag(a),u.update(c,"hex","utf8")+u.final("utf8")}function u(e){return e?e.length<=8?"****":e.substring(0,4)+"****"+e.substring(e.length-4):""}},99678:(e,t,r)=>{r.d(t,{KR:()=>a,cL:()=>c,e1:()=>l,rV:()=>u});var n=r(91088),o=r(51809);async function i(){let e=await (0,o.Gw)();if(!e.openaiApiKey)throw Error("OpenAI API key not configured. Please configure it in Admin > Settings.");return new n.default({apiKey:e.openaiApiKey})}async function s(){let e=await (0,o.Gw)();return{gptModel:e.openaiModel||"gpt-4o",whisperModel:e.whisperModel||"whisper-1"}}async function a(e,t){let r=await i(),n=await s(),o=new File([e],t,{type:"audio/webm"}),a=await r.audio.transcriptions.create({file:o,model:n.whisperModel,response_format:"verbose_json"});return{text:a.text,language:a.language||"en",duration:a.duration||0}}async function c(e,t,r){let n=`You are an expert at analyzing one-on-one meeting transcripts. 
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

Be thorough but concise. Focus on actionable insights.`,o=`Analyze this one-on-one meeting transcript:

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

Only respond with valid JSON, no additional text.`,a=await i(),c=await s(),u=(await a.chat.completions.create({model:c.gptModel,messages:[{role:"system",content:n},{role:"user",content:o}],temperature:.3,response_format:{type:"json_object"}})).choices[0].message.content;if(!u)throw Error("No response from OpenAI");return JSON.parse(u)}async function u(e,t){let r=`You are a search assistant. Given a search query and a list of meeting transcripts, 
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
Only include transcripts with relevance > 30. Sort by relevance descending.`,o=await i(),s=(await o.chat.completions.create({model:"gpt-4o-mini",messages:[{role:"system",content:r},{role:"user",content:n}],temperature:.1,response_format:{type:"json_object"}})).choices[0].message.content;if(!s)return[];let a=JSON.parse(s);return(a.results||a||[]).map(t=>({id:e[t.index]?.id,meetingId:e[t.index]?.meetingId,relevance:t.relevance,snippet:t.snippet})).filter(e=>e.id)}async function l(e){let t=`You are an organizational analyst. Analyze aggregated one-on-one meeting data 
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

Only respond with valid JSON.`,n=await i(),o=await s(),a=(await n.chat.completions.create({model:o.gptModel,messages:[{role:"system",content:t},{role:"user",content:r}],temperature:.3,response_format:{type:"json_object"}})).choices[0].message.content;if(!a)throw Error("No response from OpenAI");return JSON.parse(a)}},72331:(e,t,r)=>{r.d(t,{_:()=>o});var n=r(53524);let o=globalThis.prisma??new n.PrismaClient({log:["error"]})},51809:(e,t,r)=>{r.d(t,{Gw:()=>a,VP:()=>c});var n=r(72331),o=r(36494);let i=null,s=0;async function a(){if(i&&Date.now()-s<3e5)return i;let e=await n._.systemSettings.findUnique({where:{id:"system"}});if(!e)return{openaiApiKey:process.env.OPENAI_API_KEY||null,openaiModel:"gpt-4o",whisperModel:"whisper-1",awsRegion:process.env.AWS_REGION||null,awsAccessKeyId:process.env.AWS_ACCESS_KEY_ID||null,awsSecretKey:process.env.AWS_SECRET_ACCESS_KEY||null,awsS3Bucket:process.env.AWS_S3_BUCKET||null,maxRecordingMins:25};let t={openaiApiKey:e.openaiApiKey?(0,o.pe)(e.openaiApiKey):process.env.OPENAI_API_KEY||null,openaiModel:e.openaiModel,whisperModel:e.whisperModel,awsRegion:e.awsRegion||process.env.AWS_REGION||null,awsAccessKeyId:e.awsAccessKeyId||process.env.AWS_ACCESS_KEY_ID||null,awsSecretKey:e.awsSecretKey?(0,o.pe)(e.awsSecretKey):process.env.AWS_SECRET_ACCESS_KEY||null,awsS3Bucket:e.awsS3Bucket||process.env.AWS_S3_BUCKET||null,maxRecordingMins:e.maxRecordingMins};return i=t,s=Date.now(),t}async function c(e){let t={};return void 0!==e.openaiApiKey&&(t.openaiApiKey=e.openaiApiKey?(0,o.HI)(e.openaiApiKey):null),void 0!==e.openaiModel&&(t.openaiModel=e.openaiModel),void 0!==e.whisperModel&&(t.whisperModel=e.whisperModel),void 0!==e.awsRegion&&(t.awsRegion=e.awsRegion),void 0!==e.awsAccessKeyId&&(t.awsAccessKeyId=e.awsAccessKeyId),void 0!==e.awsSecretKey&&(t.awsSecretKey=e.awsSecretKey?(0,o.HI)(e.awsSecretKey):null),void 0!==e.awsS3Bucket&&(t.awsS3Bucket=e.awsS3Bucket),void 0!==e.maxRecordingMins&&(t.maxRecordingMins=e.maxRecordingMins),await n._.systemSettings.upsert({where:{id:"system"},create:{id:"system",...t},update:t}),i=null,s=0,a()}},58585:(e,t,r)=>{var n=r(61085);r.o(n,"notFound")&&r.d(t,{notFound:function(){return n.notFound}}),r.o(n,"redirect")&&r.d(t,{redirect:function(){return n.redirect}})},61085:(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{ReadonlyURLSearchParams:function(){return s},RedirectType:function(){return n.RedirectType},notFound:function(){return o.notFound},permanentRedirect:function(){return n.permanentRedirect},redirect:function(){return n.redirect}});let n=r(83953),o=r(16399);class i extends Error{constructor(){super("Method unavailable on `ReadonlyURLSearchParams`. Read more: https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams")}}class s extends URLSearchParams{append(){throw new i}delete(){throw new i}set(){throw new i}sort(){throw new i}}("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)},16399:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{isNotFoundError:function(){return o},notFound:function(){return n}});let r="NEXT_NOT_FOUND";function n(){let e=Error(r);throw e.digest=r,e}function o(e){return"object"==typeof e&&null!==e&&"digest"in e&&e.digest===r}("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)},8586:(e,t)=>{var r;Object.defineProperty(t,"__esModule",{value:!0}),Object.defineProperty(t,"RedirectStatusCode",{enumerable:!0,get:function(){return r}}),function(e){e[e.SeeOther=303]="SeeOther",e[e.TemporaryRedirect=307]="TemporaryRedirect",e[e.PermanentRedirect=308]="PermanentRedirect"}(r||(r={})),("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)},83953:(e,t,r)=>{var n;Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{RedirectType:function(){return n},getRedirectError:function(){return c},getRedirectStatusCodeFromError:function(){return f},getRedirectTypeFromError:function(){return m},getURLFromRedirectError:function(){return p},isRedirectError:function(){return d},permanentRedirect:function(){return l},redirect:function(){return u}});let o=r(54580),i=r(72934),s=r(8586),a="NEXT_REDIRECT";function c(e,t,r){void 0===r&&(r=s.RedirectStatusCode.TemporaryRedirect);let n=Error(a);n.digest=a+";"+t+";"+e+";"+r+";";let i=o.requestAsyncStorage.getStore();return i&&(n.mutableCookies=i.mutableCookies),n}function u(e,t){void 0===t&&(t="replace");let r=i.actionAsyncStorage.getStore();throw c(e,t,(null==r?void 0:r.isAction)?s.RedirectStatusCode.SeeOther:s.RedirectStatusCode.TemporaryRedirect)}function l(e,t){void 0===t&&(t="replace");let r=i.actionAsyncStorage.getStore();throw c(e,t,(null==r?void 0:r.isAction)?s.RedirectStatusCode.SeeOther:s.RedirectStatusCode.PermanentRedirect)}function d(e){if("object"!=typeof e||null===e||!("digest"in e)||"string"!=typeof e.digest)return!1;let[t,r,n,o]=e.digest.split(";",4),i=Number(o);return t===a&&("replace"===r||"push"===r)&&"string"==typeof n&&!isNaN(i)&&i in s.RedirectStatusCode}function p(e){return d(e)?e.digest.split(";",3)[2]:null}function m(e){if(!d(e))throw Error("Not a redirect error");return e.digest.split(";",2)[1]}function f(e){if(!d(e))throw Error("Not a redirect error");return Number(e.digest.split(";",4)[3])}(function(e){e.push="push",e.replace="replace"})(n||(n={})),("function"==typeof t.default||"object"==typeof t.default&&null!==t.default)&&void 0===t.default.__esModule&&(Object.defineProperty(t.default,"__esModule",{value:!0}),Object.assign(t.default,t),e.exports=t.default)}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[9276,8966,5972,1088],()=>r(56398));module.exports=n})();