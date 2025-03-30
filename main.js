import { LOGGER } from "./LOGGER.js";
import inquirer from "inquirer";
import got from 'got';
import fs from 'fs';
import fse from 'fs-extra';
import AdmZip from "adm-zip";
import pMap from "p-map";
import pRetry from "p-retry";

// const prompt = inquirer.createPromptModule();
// await prompt([
//     {
//         type: "list",
//         name: "type",
//         message: "请选择你需要安装服务端的Loader",
//         choices: ["MinecraftForge", "NeoForge"],
//         pageSize: 4,
//         loop: false,
//       },
//       {
//         type: "input",
//         name: "mcv",
//         message: "请输入Minecraft版本",
//         loop: false,
//       },
//       {
//         type: "input",
//         name: "ldv",
//         message: "请输入模组加载器版本",
//         loop: false,
//       }
// ]).then(async (answers)=>{
// await Install(answers.type,answers.mcv,answers.ldv)
// })

await Install("MinecraftForge","1.20.1","47.3.10")

async function Install(type,minecraftversion,loaderversion) { //instance
  const forgepath = `./instance/[${type}]${minecraftversion}-${loaderversion}`
  if(type == "MinecraftForge"){
   const forgedata =  (await got.get(`https://bmclapi2.bangbang93.com/forge/download?mcversion=${minecraftversion}&version=${loaderversion}&category=installer&format=jar`,{headers:{"User-Agent":"AIF/1.0.0"}})).rawBody
    fse.outputFileSync(`${forgepath}/Forge-${minecraftversion}-${loaderversion}.jar`,forgedata) //下载Installer.jar
    LOGGER.info(`下载Forge-${minecraftversion}-${loaderversion}.jar完成！`)
    const zip = new AdmZip(`${forgepath}/Forge-${minecraftversion}-${loaderversion}.jar`).getEntries()
    for(let x=0;x<zip.length;x++){ //获取ZIP里的version.json信息
      const e = zip[x]
if(e.entryName == "version.json"){
const fvdata = JSON.parse(e.getData().toString('utf-8')).libraries
for(let c=0;c<fvdata.length;c++){
  const t=fvdata[c].downloads.artifact
  await fastdownload(`https://bmclapi2.bangbang93.com/maven${new URL(t.url).pathname}`,`${forgepath}/libraries/${t.path}`,16)
}
}else if(e.entryName == "install_profile.json"){
  const fvdata = JSON.parse(e.getData().toString('utf-8')).libraries
  for(let c=0;c<fvdata.length;c++){
    const t=fvdata[c].downloads.artifact
    await fastdownload(`https://bmclapi2.bangbang93.com/maven${new URL(t.url).pathname}`,`${forgepath}/libraries/${t.path}`,16)
  }
}
    }
    LOGGER.info(`下载Forge的libraries完成！`)
    const mfv = await got.get("https://bmclapi2.bangbang93.com/mc/game/version_manifest.json",{headers:{"User-Agent":"AIF/1.0.0"}}).json()
      const mcinfo = await got.get(`https://bmclapi2.bangbang93.com${new URL(mfv.versions.find(mcv => mcv.id == minecraftversion).url).pathname}`,{headers:{"User-Agent":"AIF/1.0.0"}}).json()
      for(let d=0;d<mcinfo.libraries.length;d++){
      const g=mcinfo.libraries[d].downloads.artifact
    await fastdownload(`https://bmclapi2.bangbang93.com/maven${new URL(g.url).pathname}`,`${forgepath}/libraries/${g.path}`,16)
    }
    LOGGER.info(`下载Minecraft的Maven完成！`)
  }
}


async function fastdownload(url,path,concurrency){
  let e =[]
  e.push([url,path])
  await pMap(e,async(e)=>{ //[0]URL [1]Path   got必须为function！
      try{
      return await pRetry(
          async () => {
            if(url !== null && url !== "" && path !==null && !fse.existsSync(e[1])){
                const res = (await got.get(e[0])).rawBody; //下载文件
                await fse.outputFile(e[1],res) //保存文件
            }
          },
          {
            retries: 2,
          },
        );
      }catch(error){
          if(error.message !== "Response code 404 (Not Found)"){
              LOGGER.error({err:error})
          }
      }
  },
      {
          concurrency: concurrency,
        },
  )
}