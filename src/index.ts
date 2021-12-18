const FACTORIO_VERSION = "1.1.49.59227" as const;
const REMOTE_ADDR = "144.76.101.206" as const;
const REMOTE_PORT = 39000 as const;
const version = FACTORIO_VERSION
  .split(".")
  .map((x) => parseInt(x));

interface GlobalData {
	connectionRequestIDGeneratedOnClient?: number
	connectionRequestIDGeneratedOnServer?: number
}
const globalData: GlobalData = {

}


globalData.connectionRequestIDGeneratedOnClient = 3369486983


function printBytes(bytes: Uint8Array | Uint16Array): void {
	let str = ""
	for (const byte of bytes) {
		str = `${str} ${byte.toString(16).padStart(2, "0")}`
	}
	console.log(str)
}

function numToU8(num: number): number[] {
	return (num.toString(16).length % 2 ? '0' + num.toString(16) : num.toString(16))
		.split("")
		.map((num, i, arr) => {
			if (i % 2) return
			let bit = num + arr[i+1]
			return bit
		})
		.filter((x): x is string => Boolean(x))
		.map(x => parseInt(x, 16))
}

function u8ToNum(u8: Uint8Array): number {
	let str = ""
	for (const byte of u8) {
		str = `${str}${byte.toString(16).padStart(2, "0")}`
	}
	return parseInt(str, 16)
}

/**
 * switch endians of a number
 */
 function switchEndians(input: number) {
	const buf = new Uint8Array(numToU8(input))
	const view = new DataView(new ArrayBuffer(buf.length * 2))
	
	for (let i = 0; i < buf.length; i++) {
		const data = buf[i]
		const pos = i
		view.setUint16(pos, data, true)
	}


	const values: number[] = []
	for (let i = 1; i < buf.length + 1; i++) {
		values.push(view.getUint8(buf.length - i))
	}

	let str = ""
	const outBuf = new Uint8Array(values)
	for (const byte of outBuf) {
		str = `${str}${byte.toString(16).padStart(2, "0")}`
	}

	return parseInt(str, 16)
}

const listener = Deno.listenDatagram({
	hostname: "0.0.0.0",
	port: 39000,
	transport: "udp",
  });


async function sendConnectionRequest() {
	// connection request format is:
	// flags: 9 bytes, 0x02
	// filler 2X 0x00
	// clientApplicationVersion (Factorio version + build)
	// connectionRequestIDGeneratedOnClient. maybe random values?
	if (!globalData.connectionRequestIDGeneratedOnClient) return false

	const ConnectionRequest = new Uint8Array([
		0x02, 0x00, 0x00, 
		...version.map(x=>switchEndians(x)).map(x=>numToU8(x)).flat(),
		...numToU8(switchEndians(globalData.connectionRequestIDGeneratedOnClient))
	])

	await listener.send(ConnectionRequest, {
		hostname: REMOTE_ADDR,
		port: REMOTE_PORT,
		transport: "udp",
	})
	const [reply] = await listener.receive()
	if (
		reply[0].toString(16)[1] === "3" && // type=ConnectionRequestReply
		reply[2].toString(16)[0] === "8" // confirm = true
	) {
		const serverConnectionID = reply.slice(reply.length - 4)
		globalData.connectionRequestIDGeneratedOnServer = switchEndians(u8ToNum(serverConnectionID))
		return true as const
	} else {
		throw new Error("Did not initiate successfully")
	}
}

async function sendConnectionRequestReplyConfirm() {
	// connection request reply format is:
	// flags: 0x44
	// filler 2X 0x00
	// clientConnectionID
	// serverConnectionID
	// then some other data, need to figure out. maybe from CVDump.exe
	if (!globalData.connectionRequestIDGeneratedOnClient) return false
	if (!globalData.connectionRequestIDGeneratedOnServer) return false

	const ConnectionRequest = new Uint8Array([
		0x44, 0x00, 0x00,
		switchEndians(globalData.connectionRequestIDGeneratedOnClient), 
		switchEndians(globalData.connectionRequestIDGeneratedOnServer), 
		// other data later
	])

	await listener.send(ConnectionRequest, {
		hostname: REMOTE_ADDR,
		port: REMOTE_PORT,
		transport: "udp",
	})
}

await sendConnectionRequest()
await sendConnectionRequestReplyConfirm()