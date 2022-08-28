import { crypto } from './deps.ts'

interface IRequestInfomation {
    accessKeyId: string
    accessKeySecret: string,
    path: string
}

interface IResult {
    code: number
    message: string
    request_id: string
    data: unknown
}

interface ISignBody {
    "x-bili-accesskeyid": string
    "x-bili-content-md5": string
    "x-bili-signature-method": string
    "x-bili-signature-nonce": string
    "x-bili-signature-version": string
    "x-bili-timestamp": number
}

const utf8Encorder = new TextEncoder();

function toHex(buffer: ArrayBuffer) {
    const hashArray = Array.from(new Uint8Array(buffer));                     // convert buffer to byte array
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
}

export class BLiveApi {
    private readonly accessKeyId: string
    private readonly accessKeySecret: string
    constructor(accseeKeyId: string, accessKeySecret: string) {
        this.accessKeyId = accseeKeyId
        this.accessKeySecret = accessKeySecret
    }
    public async request(path: string, body: Record<string, unknown>): Promise<any> {
        const signKey = await crypto.subtle.importKey('raw', utf8Encorder.encode(this.accessKeySecret), { name: "HMAC", hash: { name: "SHA-256" } }, false, ['sign', 'verify'])
        const bodyJson = JSON.stringify(body)
        const randomNum = crypto.randomUUID()
        const accesskeyid = this.accessKeyId
        const time = Math.floor(Date.now() / 1000)
        const md5Hash = toHex(await crypto.subtle.digest('MD5', utf8Encorder.encode(bodyJson)))
        const sign: ISignBody = {
            "x-bili-accesskeyid": accesskeyid,
            "x-bili-content-md5": md5Hash,
            "x-bili-signature-method": "HMAC-SHA256",
            "x-bili-signature-nonce": randomNum,
            "x-bili-signature-version": "1.0",
            "x-bili-timestamp": time,
        }
        let signString = ''
        for (const l in sign) {
            if (l === 'x-bili-timestamp') {
                signString += `${l}:${sign[l as keyof ISignBody]}`
            } else {
                signString += `${l}:${sign[l as keyof ISignBody]}\n`
            }
        }
        const headers = new Headers()
        headers.append('Accept', 'application/json')
        headers.append('Content-Type', 'application/json')
        headers.append('x-bili-content-md5', md5Hash)
        headers.append('x-bili-timestamp', time.toString())
        headers.append('x-bili-signature-method', 'HMAC-SHA256')
        headers.append('x-bili-signature-nonce', randomNum)
        headers.append('x-bili-accesskeyid', accesskeyid)
        headers.append('x-bili-signature-version', '1.0')
        headers.append('Authorization', toHex(await crypto.subtle.sign('HMAC', signKey, utf8Encorder.encode(signString))))
        const res = await fetch(`https://live-open.biliapi.com/${path}`, {
            headers,
            method: 'POST',
            body: bodyJson
        })
        if (res.ok) {
            const data:IResult = await res.json()
            if (data.code !== 0) {
                throw new Error(data.code.toString())
            }
            return data.data;
        }
    }
}