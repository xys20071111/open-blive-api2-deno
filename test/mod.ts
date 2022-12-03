import { BLiveApi, InteractiveInstence } from "../mod.ts";

interface IConfig {
    key: string
    secret: string
}
const decoder = new TextDecoder()
const config: IConfig = JSON.parse(decoder.decode(Deno.readFileSync('./config.json')))


const api = new BLiveApi(config.key, config.secret)

const interactive_instance = new InteractiveInstence(1652939941573, 'BKYKFDJJFPXC7', api)

interactive_instance.on('connected', () => {
    const receiver = interactive_instance.getDanmakuReceiver()
    receiver?.on('LIVE_OPEN_PLATFORM_DM', (danmaku: unknown) => {
        console.log(danmaku)
    })
})

interactive_instance.connect()