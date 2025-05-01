import { pino } from "pino"
import inquirer from "inquirer";
import got from 'got';
import fs, { cpSync } from 'fs';
import fse from 'fs-extra';
import AdmZip from "adm-zip";
import pMap from "p-map";
import pRetry from "p-retry";
import cp from "child_process";

const gotx = got.extend({ headers: { "User-Agent": "Aif/1.0.0" } })

const LOGGER = pino({
  level: process.env.LOGLEVEL || 'info',
  transport: process.env.PLAIN_LOG
    ? undefined
    : {
      target: 'pino-pretty',
      options: {
        translateTime: 'SYS:standard',
        singleLine: true,
      },
    },
})

const prompt = inquirer.createPromptModule();
await prompt([
  {
    type: "list",
    name: "type",
    message: "请选择你需要安装服务端的Loader",
    choices: ["MinecraftForge", "NeoForge"],
    pageSize: 4,
    loop: false,
  },
  {
    type: "input",
    name: "mcv",
    message: "请输入Minecraft版本",
    loop: false,
  },
  {
    type: "input",
    name: "ldv",
    message: "请输入模组加载器版本",
    loop: false,
  }
]).then(async (answers) => {
  await Install(answers.type, answers.mcv, answers.ldv)
})

async function Install(type, minecraftversion, loaderversion) { //instance
  const mcinfo = await gotx.get(`https://bmclapi2.bangbang93.com/version/${minecraftversion}/json`).json() //获取Minecraft版本JSON
  const forgepath = `./instance/[${type}]${minecraftversion}-${loaderversion}`
  if (type == "MinecraftForge") {
    const forgedata = (await gotx.get(`https://bmclapi2.bangbang93.com/forge/download?mcversion=${minecraftversion}&version=${loaderversion}&category=installer&format=jar`)).rawBody
    fse.outputFileSync(`${forgepath}/Forge-${minecraftversion}-${loaderversion}.jar`, forgedata) //下载Installer.jar
    LOGGER.info(`下载Forge-${minecraftversion}-${loaderversion}.jar完成！`)
    const zip = new AdmZip(`${forgepath}/Forge-${minecraftversion}-${loaderversion}.jar`).getEntries()
    for (let x = 0; x < zip.length; x++) { //获取ZIP里的version.json信息
      const e = zip[x]
      if (e.entryName == "version.json") {
        const fvdata = JSON.parse(e.getData().toString('utf-8')).libraries
        for (let c = 0; c < fvdata.length; c++) { //下载依赖1
          const t = fvdata[c].downloads.artifact
          await fastdownload(`https://bmclapi2.bangbang93.com/maven${new URL(t.url).pathname}`, `${forgepath}/libraries/${t.path}`, 16)
        }
      } else if (e.entryName == "install_profile.json") {
        const json = JSON.parse(e.getData().toString('utf-8'))
        const fvdata = json.libraries
        for (let c = 0; c < fvdata.length; c++) { //下载依赖2
          const t = fvdata[c].downloads.artifact
          await fastdownload(`https://bmclapi2.bangbang93.com/maven${new URL(t.url).pathname}`, `${forgepath}/libraries/${t.path}`, 16)
        }
        //下载MAPPING与MOJMAPS
        /*MOJMAPS*/
        await fastdownload(`https://bmclapi2.bangbang93.com${new URL(mcinfo.downloads.server_mappings.url).pathname}`,`${forgepath}/libraries/${mavenToUrl(json.data.MOJMAPS.server.replace(/[[\]]/g, ''),'')}`)
        /*MAPPING*/
        const tmp = `de/oceanlabs/mcp/mcp_config/${minecraftversion}-${json.data.MCP_VERSION.server.replace(/['"]/g, '')}/mcp_config-${minecraftversion}-${json.data.MCP_VERSION.server.replace(/['"]/g, '')}.zip`
        await fastdownload(`https://bmclapi2.bangbang93.com/maven/${tmp}`,`${forgepath}/libraries/${tmp}`)
        //mojmaps.
        //fse.outputFileSync(forgepath + "./libraries" + mavenToUrl(data.MOJMAPS.server.replace(/[[\]]/g, ''), ''),)
        //const data = json.data
        //console.log(mavenToUrl(data.MAPPINGS.server.replace(/[[\]]/g, '')))
        LOGGER.info("下载MAPPING与MOJMAPS完成！")
      }
    }
    LOGGER.info(`下载Forge的libraries完成！`)
    for (let d = 0; d < mcinfo.libraries.length; d++) {
      const g = mcinfo.libraries[d].downloads.artifact
      await fastdownload(`https://bmclapi2.bangbang93.com/maven${new URL(g.url).pathname}`, `${forgepath}/libraries/${g.path}`, 16)
    }
    LOGGER.info(`下载Minecraft的Maven完成！`)
    await fastdownload(`https://bmclapi2.bangbang93.com/version/${minecraftversion}/server`, `${forgepath}/libraries/net/minecraft/server/${minecraftversion}/server-${minecraftversion}.jar`, 1)
try{
    cp.execSync(`java -jar Forge-${minecraftversion}-${loaderversion}.jar --installServer`, { cwd: forgepath }) //执行Forge安装命令
  }catch(e){}
    cp.execSync(`mshta "javascript:var sh=new ActiveXObject("WScript.Shell"); sh.Popup("MinecraftForge安装完成！", 30, "AutoInstalForge", 64 );close()"`)
    LOGGER.info("Forge安装完成！！！")
  }
}


async function fastdownload(url, path, concurrency) {
  let e = []
  e.push([url, path])
  await pMap(e, async (e) => { //[0]URL [1]Path   got必须为function！
    try {
      return await pRetry(
        async () => {
          if (url !== null && url !== "" && path !== null && !fse.existsSync(e[1])) {
            const res = (await gotx.get(e[0])).rawBody; //下载文件
            await fse.outputFile(e[1], res) //保存文件
          }
        },
        {
          retries: 2,
        },
      );
    } catch (error) {
      LOGGER.error({ err: error })
    }
  },
    {
      concurrency: concurrency,
    },
  )
}

function mavenToUrl(coordinate, base = 'https://bmclapi2.bangbang93.com/maven') {
  const [g, a, v, ce] = coordinate.split(':');
  const [c, e = 'jar'] = (ce || '').split('@');
  return `${base.replace(/\/$/, '')}/${g.replace(/\./g, '/')}/${a}/${v}/${a}-${v}${c ? '-' + c : ''}.${e}`;
}