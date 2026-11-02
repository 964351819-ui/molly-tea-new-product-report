import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.join(root,'.publish/repo');
const shared=path.resolve(root,'../茉莉奶白测算工具/.publish');
const gh=path.join(shared,'tools/gh_2.103.3_macOS_arm64/bin/gh');
const env={...process.env,GH_CONFIG_DIR:path.join(shared,'auth'),GIT_TERMINAL_PROMPT:'0'};
const remote='https://github.com/964351819-ui/molly-tea-new-product-report.git';
const website='https://964351819-ui.github.io/molly-tea-new-product-report/';
const files=['index.html','README.md','tests/regression.cjs','.gitignore','发布.command','发布说明.md','scripts/publish.mjs'];
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
function run(cmd,args,cwd=root){return execFileSync(cmd,args,{cwd,env,encoding:'utf8',timeout:45000,maxBuffer:3*1024*1024,stdio:['ignore','pipe','pipe']}).trim()}
const git=(...args)=>run('git',['-c','http.version=HTTP/1.1',...args],repo);
function check(){
  for(const file of files)if(!fs.existsSync(path.join(root,file)))throw new Error('缺少发布文件：'+file);
  const data=fs.readFileSync(path.join(root,'index.html')),html=data.toString('utf8');
  for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
  console.log(run(process.execPath,['tests/regression.cjs']));
  console.log('本地检查通过，发布目标固定为报表工具仓库。');return {data,digest:hash(data)};
}
async function verify(source){
  const deadline=Date.now()+240000;
  while(Date.now()<deadline){
    try{
      const data=execFileSync('curl',['-4','--http1.1','--compressed','-fsSL','--connect-timeout','8','--max-time','20',website+'?verify='+Date.now()],{timeout:23000,maxBuffer:3*1024*1024,stdio:['ignore','pipe','pipe']});
      if(hash(data)===source.digest){console.log('线上完整文件 SHA256 一致：'+source.digest+'\n'+website);return}
    }catch{}
    await delay(10000);
  }
  throw new Error('线上核验超时，提交不会回退；请稍后运行 bash 发布.command --verify。');
}
async function main(){
  const mode=process.argv[2];if(process.argv.length>3||![undefined,'--check','--verify'].includes(mode))throw new Error('用法：bash 发布.command [--check | --verify]');
  const source=check();if(mode==='--check')return;if(mode==='--verify')return verify(source);
  if(!fs.existsSync(gh))throw new Error('未找到测算工具已安装的 GitHub CLI，请检查相邻项目位置。');
  try{run(gh,['auth','status','--hostname','github.com'])}catch{throw new Error('GitHub 授权未完成或已失效，请先运行测算工具的“登录发布.command”。')}
  const account=run(gh,['api','user','--jq','.login']);if(account!=='964351819-ui')throw new Error('GitHub 登录账号与固定仓库所有者不一致。');
  fs.mkdirSync(path.dirname(repo),{recursive:true});
  if(!fs.existsSync(repo))run('git',['clone','--depth','1',remote,repo]);
  if(git('remote','get-url','origin')!==remote||git('branch','--show-current')!=='main')throw new Error('发布克隆的仓库或分支异常，停止。');
  if(git('status','--porcelain'))throw new Error('发布克隆存在未提交改动，已保留现场，停止发布。');
  git('config','--local','--replace-all','credential.helper','');
  git('config','--local','--add','credential.helper',`!"${gh}" auth git-credential`);
  git('fetch','origin','main');git('merge','--ff-only','origin/main');
  const ahead=git('diff','--name-only','origin/main...HEAD').split('\n').filter(Boolean);
  if(ahead.some(file=>!files.includes(file)))throw new Error('发布克隆存在非本工具文件的待推送提交，停止发布。');
  for(const file of files){const target=path.join(repo,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target)}
  git('add','--',...files);
  if(git('diff','--cached','--name-only')){
    try{git('config','user.name')}catch{git('config','--local','user.name',account)}
    try{git('config','user.email')}catch{git('config','--local','user.email',account+'@users.noreply.github.com')}
    git('commit','-m','统一商品名称清理并支持脚本发布');
  }
  if(git('rev-parse','HEAD')!==git('rev-parse','origin/main')){git('push','origin','main');console.log('已推送报表仓库：'+git('rev-parse','--short','HEAD'))}
  else console.log('无内容变化，不重复提交。');
  await verify(source);
}
main().catch(error=>{console.error('发布未完成：'+(error.status!=null?'命令执行失败，请核对网络或授权；本地与远程现场均已保留。':error.message));process.exitCode=1});
