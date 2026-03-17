"use strict";(()=>{var e={};e.id=7281,e.ids=[7281,6119],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},78893:e=>{e.exports=require("buffer")},61282:e=>{e.exports=require("child_process")},84770:e=>{e.exports=require("crypto")},92048:e=>{e.exports=require("fs")},20629:e=>{e.exports=require("fs/promises")},32615:e=>{e.exports=require("http")},35240:e=>{e.exports=require("https")},19801:e=>{e.exports=require("os")},55315:e=>{e.exports=require("path")},35816:e=>{e.exports=require("process")},76162:e=>{e.exports=require("stream")},17360:e=>{e.exports=require("url")},21764:e=>{e.exports=require("util")},92761:e=>{e.exports=require("node:async_hooks")},6005:e=>{e.exports=require("node:crypto")},87561:e=>{e.exports=require("node:fs")},93977:e=>{e.exports=require("node:fs/promises")},70612:e=>{e.exports=require("node:os")},49411:e=>{e.exports=require("node:path")},91940:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>x,patchFetch:()=>b,requestAsyncStorage:()=>g,routeModule:()=>h,serverHooks:()=>f,staticGenerationAsyncStorage:()=>y});var n={};r.r(n),r.d(n,{POST:()=>u});var i=r(49303),o=r(88716),a=r(60670),s=r(87070),d=r(72331),p=r(76876),l=r(36119);async function u(e){let t=e.headers.get("x-cron-secret");if(process.env.CRON_SECRET&&t!==process.env.CRON_SECRET)return s.NextResponse.json({error:"Unauthorized"},{status:401});try{let e={recurringMeetingsCreated:0,reminders24hSent:0,reminders1hSent:0,errors:[]};return await c(e),await m(e),s.NextResponse.json({success:!0,...e})}catch(e){return console.error("Error in cron job:",e),s.NextResponse.json({error:"Cron job failed"},{status:500})}}async function c(e){let t=new Date;for(let r of(await d._.recurringSchedule.findMany({where:{isActive:!0,nextMeetingDate:{lte:t}},include:{reporter:{select:{id:!0,name:!0,email:!0}}}})))try{let n=await d._.meeting.create({data:{employeeId:r.employeeId,reporterId:r.reporterId,meetingDate:r.nextMeetingDate||t,recurringScheduleId:r.id}}),i=function(e,t,r,n){let[i,o]=t.split(":").map(Number),a=new Date(n);switch(r){case"WEEKLY":a.setDate(a.getDate()+7);break;case"BIWEEKLY":a.setDate(a.getDate()+14);break;case"MONTHLY":a.setMonth(a.getMonth()+1);let s=e-a.getDay();s<0&&(s+=7),a.setDate(a.getDate()+s)}return a.setHours(i,o,0,0),a}(r.dayOfWeek,r.timeOfDay,r.frequency,r.nextMeetingDate||t);await d._.recurringSchedule.update({where:{id:r.id},data:{nextMeetingDate:i,lastGeneratedAt:t}}),await (0,p.qf)(r.employeeId,r.reporter.name||"Your manager",r.nextMeetingDate||t,n.id),e.recurringMeetingsCreated++}catch(t){console.error(`Error creating recurring meeting for schedule ${r.id}:`,t),e.errors.push(`Failed to create meeting for schedule ${r.id}`)}}async function m(e){let t=new Date,r=new Date(t.getTime()+864e5),n=new Date(t.getTime()+36e5),i=await d._.systemSettings.findUnique({where:{id:"system"}});if(!i||i.enableEmailReminders){for(let n of(await d._.meeting.findMany({where:{status:"SCHEDULED",reminder24hSent:!1,meetingDate:{gte:t,lte:r}},include:{employee:{select:{id:!0,name:!0,email:!0}},reporter:{select:{id:!0,name:!0,email:!0}}}})))try{await (0,p.WN)(n.employeeId,n.reporter.name||"your manager",n.meetingDate,n.id,24),await (0,p.WN)(n.reporterId,n.employee.name||"your team member",n.meetingDate,n.id,24);try{await (0,l.C)({to:n.employee.email,subject:"Meeting Reminder: One-on-One Tomorrow",text:`Hi ${n.employee.name},

This is a reminder that you have a one-on-one meeting scheduled with ${n.reporter.name} tomorrow at ${n.meetingDate.toLocaleTimeString()}.

Please prepare any topics you'd like to discuss.

Best,
AMI One-on-One System`,html:`<p>Hi ${n.employee.name},</p><p>This is a reminder that you have a one-on-one meeting scheduled with <strong>${n.reporter.name}</strong> tomorrow at <strong>${n.meetingDate.toLocaleTimeString()}</strong>.</p><p>Please prepare any topics you'd like to discuss.</p><p>Best,<br/>AMI One-on-One System</p>`})}catch(e){console.error("Failed to send reminder email:",e)}await d._.meeting.update({where:{id:n.id},data:{reminder24hSent:!0}}),e.reminders24hSent++}catch(t){console.error(`Error sending 24h reminder for meeting ${n.id}:`,t),e.errors.push(`Failed to send 24h reminder for meeting ${n.id}`)}for(let r of(await d._.meeting.findMany({where:{status:"SCHEDULED",reminderSent:!1,meetingDate:{gte:t,lte:n}},include:{employee:{select:{id:!0,name:!0,email:!0}},reporter:{select:{id:!0,name:!0,email:!0}}}})))try{await (0,p.WN)(r.employeeId,r.reporter.name||"your manager",r.meetingDate,r.id,1),await (0,p.WN)(r.reporterId,r.employee.name||"your team member",r.meetingDate,r.id,1),await d._.meeting.update({where:{id:r.id},data:{reminderSent:!0}}),e.reminders1hSent++}catch(t){console.error(`Error sending 1h reminder for meeting ${r.id}:`,t),e.errors.push(`Failed to send 1h reminder for meeting ${r.id}`)}}}let h=new i.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/cron/meetings/route",pathname:"/api/cron/meetings",filename:"route",bundlePath:"app/api/cron/meetings/route"},resolvedPagePath:"/Users/nishantrana/Library/Mobile Documents/com~apple~CloudDocs/Cursor/AMI One on One/app/api/cron/meetings/route.ts",nextConfigOutput:"standalone",userland:n}),{requestAsyncStorage:g,staticGenerationAsyncStorage:y,serverHooks:f}=h,x="/api/cron/meetings/route";function b(){return(0,a.patchFetch)({serverHooks:f,staticGenerationAsyncStorage:y})}},36119:(e,t,r)=>{r.d(t,{C:()=>s,sendFormSubmittedEmail:()=>l,sendMeetingScheduledEmail:()=>d,sendTodoAssignedEmail:()=>p});var n=r(47554),i=r(19146);let o=new n.W({region:process.env.AWS_REGION||"us-east-1",credentials:{accessKeyId:process.env.AWS_ACCESS_KEY_ID,secretAccessKey:process.env.AWS_SECRET_ACCESS_KEY}}),a=process.env.AWS_SES_FROM_EMAIL||"noreply@example.com";async function s({to:e,subject:t,html:r,text:n}){try{let s=Array.isArray(e)?e:[e],d=new i.K({Source:a,Destination:{ToAddresses:s},Message:{Subject:{Data:t,Charset:"UTF-8"},Body:{Html:{Data:r,Charset:"UTF-8"},...n&&{Text:{Data:n,Charset:"UTF-8"}}}}});return(await o.send(d)).MessageId}catch(e){throw console.error("Error sending email:",e),e}}async function d(e,t,r,n,i,o){let a=new Intl.DateTimeFormat("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"}).format(i),d=`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #F37022; color: white; padding: 20px; border-radius: 12px 12px 0 0; }
          .content { background-color: #F7F6F5; padding: 30px; border-radius: 0 0 12px 12px; }
          .button { display: inline-block; background-color: #F37022; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>One-on-One Meeting Scheduled</h1>
          </div>
          <div class="content">
            <p>Hi ${t},</p>
            <p>A one-on-one meeting has been scheduled with ${n}.</p>
            <p><strong>Date & Time:</strong> ${a}</p>
            <p>Please prepare your one-on-one form before the meeting.</p>
            <a href="${process.env.NEXTAUTH_URL}/meetings/${o}" class="button">View Meeting</a>
          </div>
        </div>
      </body>
    </html>
  `;await Promise.all([s({to:e,subject:`One-on-One Meeting Scheduled with ${n}`,html:d}),s({to:r,subject:`One-on-One Meeting Scheduled with ${t}`,html:d.replace(`Hi ${t}`,`Hi ${n}`)})])}async function p(e,t,r,n,i,o,a){let d=i?new Intl.DateTimeFormat("en-US",{year:"numeric",month:"long",day:"numeric"}).format(i):"No due date",p=`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #F37022; color: white; padding: 20px; border-radius: 12px 12px 0 0; }
          .content { background-color: #F7F6F5; padding: 30px; border-radius: 0 0 12px 12px; }
          .button { display: inline-block; background-color: #F37022; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New To-Do Assigned</h1>
          </div>
          <div class="content">
            <p>Hi ${t},</p>
            <p>You have been assigned a new to-do:</p>
            <p><strong>${r}</strong></p>
            ${n?`<p>${n}</p>`:""}
            <p><strong>Due Date:</strong> ${d}</p>
            <p><strong>Assigned by:</strong> ${o}</p>
            <a href="${process.env.NEXTAUTH_URL}/todos" class="button">View To-Do</a>
          </div>
        </div>
      </body>
    </html>
  `;await s({to:e,subject:`New To-Do: ${r}`,html:p})}async function l(e,t,r,n,i){let o=new Intl.DateTimeFormat("en-US",{year:"numeric",month:"long",day:"numeric"}).format(n),a=`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #F37022; color: white; padding: 20px; border-radius: 12px 12px 0 0; }
          .content { background-color: #F7F6F5; padding: 30px; border-radius: 0 0 12px 12px; }
          .button { display: inline-block; background-color: #F37022; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>One-on-One Form Submitted</h1>
          </div>
          <div class="content">
            <p>Hi ${t},</p>
            <p>${r} has submitted their one-on-one form for the meeting scheduled on ${o}.</p>
            <p>Please review their responses before the meeting.</p>
            <a href="${process.env.NEXTAUTH_URL}/meetings/${i}" class="button">View Form</a>
          </div>
        </div>
      </body>
    </html>
  `;await s({to:e,subject:`${r} has submitted their one-on-one form`,html:a})}},76876:(e,t,r)=>{r.d(t,{Go:()=>s,Ix:()=>a,WN:()=>l,k9:()=>d,kW:()=>o,qf:()=>p});var n=r(72331);async function i(e){return n._.notification.create({data:{userId:e.userId,type:e.type,title:e.title,message:e.message,link:e.link,data:e.data}})}async function o(e,t=50){return n._.notification.findMany({where:{userId:e},orderBy:{createdAt:"desc"},take:t})}async function a(e,t){return n._.notification.updateMany({where:{id:e,userId:t},data:{isRead:!0}})}async function s(e){return n._.notification.updateMany({where:{userId:e,isRead:!1},data:{isRead:!0}})}async function d(e){return n._.notification.count({where:{userId:e,isRead:!1}})}async function p(e,t,r,n){return i({userId:e,type:"MEETING_SCHEDULED",title:"New Meeting Scheduled",message:`${t} has scheduled a one-on-one meeting with you on ${r.toLocaleDateString()}`,link:`/meetings/${n}`})}async function l(e,t,r,n,o){return i({userId:e,type:"MEETING_REMINDER",title:"Meeting Reminder",message:`Your one-on-one with ${t} is in ${o} hours`,link:`/meetings/${n}`})}},72331:(e,t,r)=>{r.d(t,{_:()=>i});var n=r(53524);let i=globalThis.prisma??new n.PrismaClient({log:["error"]})},79925:e=>{var t=Object.defineProperty,r=Object.getOwnPropertyDescriptor,n=Object.getOwnPropertyNames,i=Object.prototype.hasOwnProperty,o={};function a(e){var t;let r=["path"in e&&e.path&&`Path=${e.path}`,"expires"in e&&(e.expires||0===e.expires)&&`Expires=${("number"==typeof e.expires?new Date(e.expires):e.expires).toUTCString()}`,"maxAge"in e&&"number"==typeof e.maxAge&&`Max-Age=${e.maxAge}`,"domain"in e&&e.domain&&`Domain=${e.domain}`,"secure"in e&&e.secure&&"Secure","httpOnly"in e&&e.httpOnly&&"HttpOnly","sameSite"in e&&e.sameSite&&`SameSite=${e.sameSite}`,"partitioned"in e&&e.partitioned&&"Partitioned","priority"in e&&e.priority&&`Priority=${e.priority}`].filter(Boolean),n=`${e.name}=${encodeURIComponent(null!=(t=e.value)?t:"")}`;return 0===r.length?n:`${n}; ${r.join("; ")}`}function s(e){let t=new Map;for(let r of e.split(/; */)){if(!r)continue;let e=r.indexOf("=");if(-1===e){t.set(r,"true");continue}let[n,i]=[r.slice(0,e),r.slice(e+1)];try{t.set(n,decodeURIComponent(null!=i?i:"true"))}catch{}}return t}function d(e){var t,r;if(!e)return;let[[n,i],...o]=s(e),{domain:a,expires:d,httponly:u,maxage:c,path:m,samesite:h,secure:g,partitioned:y,priority:f}=Object.fromEntries(o.map(([e,t])=>[e.toLowerCase(),t]));return function(e){let t={};for(let r in e)e[r]&&(t[r]=e[r]);return t}({name:n,value:decodeURIComponent(i),domain:a,...d&&{expires:new Date(d)},...u&&{httpOnly:!0},..."string"==typeof c&&{maxAge:Number(c)},path:m,...h&&{sameSite:p.includes(t=(t=h).toLowerCase())?t:void 0},...g&&{secure:!0},...f&&{priority:l.includes(r=(r=f).toLowerCase())?r:void 0},...y&&{partitioned:!0}})}((e,r)=>{for(var n in r)t(e,n,{get:r[n],enumerable:!0})})(o,{RequestCookies:()=>u,ResponseCookies:()=>c,parseCookie:()=>s,parseSetCookie:()=>d,stringifyCookie:()=>a}),e.exports=((e,o,a,s)=>{if(o&&"object"==typeof o||"function"==typeof o)for(let a of n(o))i.call(e,a)||void 0===a||t(e,a,{get:()=>o[a],enumerable:!(s=r(o,a))||s.enumerable});return e})(t({},"__esModule",{value:!0}),o);var p=["strict","lax","none"],l=["low","medium","high"],u=class{constructor(e){this._parsed=new Map,this._headers=e;let t=e.get("cookie");if(t)for(let[e,r]of s(t))this._parsed.set(e,{name:e,value:r})}[Symbol.iterator](){return this._parsed[Symbol.iterator]()}get size(){return this._parsed.size}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed);if(!e.length)return r.map(([e,t])=>t);let n="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(([e])=>e===n).map(([e,t])=>t)}has(e){return this._parsed.has(e)}set(...e){let[t,r]=1===e.length?[e[0].name,e[0].value]:e,n=this._parsed;return n.set(t,{name:t,value:r}),this._headers.set("cookie",Array.from(n).map(([e,t])=>a(t)).join("; ")),this}delete(e){let t=this._parsed,r=Array.isArray(e)?e.map(e=>t.delete(e)):t.delete(e);return this._headers.set("cookie",Array.from(t).map(([e,t])=>a(t)).join("; ")),r}clear(){return this.delete(Array.from(this._parsed.keys())),this}[Symbol.for("edge-runtime.inspect.custom")](){return`RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(e=>`${e.name}=${encodeURIComponent(e.value)}`).join("; ")}},c=class{constructor(e){var t,r,n;this._parsed=new Map,this._headers=e;let i=null!=(n=null!=(r=null==(t=e.getSetCookie)?void 0:t.call(e))?r:e.get("set-cookie"))?n:[];for(let e of Array.isArray(i)?i:function(e){if(!e)return[];var t,r,n,i,o,a=[],s=0;function d(){for(;s<e.length&&/\s/.test(e.charAt(s));)s+=1;return s<e.length}for(;s<e.length;){for(t=s,o=!1;d();)if(","===(r=e.charAt(s))){for(n=s,s+=1,d(),i=s;s<e.length&&"="!==(r=e.charAt(s))&&";"!==r&&","!==r;)s+=1;s<e.length&&"="===e.charAt(s)?(o=!0,s=i,a.push(e.substring(t,n)),t=s):s=n+1}else s+=1;(!o||s>=e.length)&&a.push(e.substring(t,e.length))}return a}(i)){let t=d(e);t&&this._parsed.set(t.name,t)}}get(...e){let t="string"==typeof e[0]?e[0]:e[0].name;return this._parsed.get(t)}getAll(...e){var t;let r=Array.from(this._parsed.values());if(!e.length)return r;let n="string"==typeof e[0]?e[0]:null==(t=e[0])?void 0:t.name;return r.filter(e=>e.name===n)}has(e){return this._parsed.has(e)}set(...e){let[t,r,n]=1===e.length?[e[0].name,e[0].value,e[0]]:e,i=this._parsed;return i.set(t,function(e={name:"",value:""}){return"number"==typeof e.expires&&(e.expires=new Date(e.expires)),e.maxAge&&(e.expires=new Date(Date.now()+1e3*e.maxAge)),(null===e.path||void 0===e.path)&&(e.path="/"),e}({name:t,value:r,...n})),function(e,t){for(let[,r]of(t.delete("set-cookie"),e)){let e=a(r);t.append("set-cookie",e)}}(i,this._headers),this}delete(...e){let[t,r,n]="string"==typeof e[0]?[e[0]]:[e[0].name,e[0].path,e[0].domain];return this.set({name:t,path:r,domain:n,value:"",expires:new Date(0)})}[Symbol.for("edge-runtime.inspect.custom")](){return`ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`}toString(){return[...this._parsed.values()].map(a).join("; ")}}},92044:(e,t,r)=>{Object.defineProperty(t,"__esModule",{value:!0}),function(e,t){for(var r in t)Object.defineProperty(e,r,{enumerable:!0,get:t[r]})}(t,{RequestCookies:function(){return n.RequestCookies},ResponseCookies:function(){return n.ResponseCookies},stringifyCookie:function(){return n.stringifyCookie}});let n=r(79925)}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[9276,5972,5962,6086],()=>r(91940));module.exports=n})();