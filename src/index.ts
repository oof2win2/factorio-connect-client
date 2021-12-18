type VERSION = `${number}.${number}.${number}`
interface GlobalData {
	connectionRequestIDGeneratedOnClient: number
	connectionRequestIDGeneratedOnServer?: number
	instanceID: number
	username: string
	gamePassword: string
	serverKey: string
	serverKeyTimestamp: string
	coreChecksum: number
	prototypeListChecksum: number
	mods: {
		name: string,
		version: VERSION
		crc: number
	}[]
	/**
	 * sequence number. increments by one every time something is sent
	 */
	sequenceNumberToSend: number
	transferBlockNumber: number
}

const FACTORIO_VERSION: VERSION = "1.1.49.59227" as const;
const REMOTE_ADDR = "144.76.101.206" as const;
const REMOTE_PORT = 39000 as const;
const version = FACTORIO_VERSION
  .split(".")
  .map((x) => parseInt(x));

const globalData: GlobalData = {
	connectionRequestIDGeneratedOnClient: 0x12345688,
	instanceID: 1923959348,
	username: "oof2win3",
	gamePassword: "",
	serverKey: "qXIuKKtimqugRwdCLV9gQw==",
	serverKeyTimestamp: "",
	coreChecksum: 1625176034,
	prototypeListChecksum: 3034860339,
	mods: [{
		name: "base",
		version: "1.1.49",
		crc: 3210524035
	}],
	sequenceNumberToSend: NaN,
	transferBlockNumber: 0,
}

const REMOTE = {
	hostname: REMOTE_ADDR,
	port: REMOTE_PORT,
	transport: "udp",
} as const


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

function stringToU8(string: string): number[] {
	const output = []
	for (let i = 0; i < string.length; i++) {
	  output.push(string.charCodeAt(i))
	}
	return output
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

	await listener.send(ConnectionRequest, REMOTE)
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
	// header confirm: 0x01 0x00
	// clientConnectionID
	// serverConnectionID
	// instance ID - maybe 
	// username length
	// username
	// password hash length (game password) - 0 if no password
	// password
	// server key length - 0 if no password?
	// server key
	// server key timestamp length - seems to be 0 on regular?
	// server key timestamp
	// core checksum - 1625176034 for dev-dump?
	// prototype list checksum - 3034860339 for base game?
	// active mods size (including base)
	// for each mod:
	// 		mod name length
	//		mod name
	// 		major version
	// 		minor version
	// 		sub/patch version
	// 		mod CRC
	// startup mod settings - 00 for no mod settings

	if (!globalData.connectionRequestIDGeneratedOnClient) return false
	if (!globalData.connectionRequestIDGeneratedOnServer) return false

	const ConnectionRequest = new Uint8Array([
		0x24, 0x01, 0x00,
		...numToU8(switchEndians(globalData.connectionRequestIDGeneratedOnClient)), 
		...numToU8(switchEndians(globalData.connectionRequestIDGeneratedOnServer)),
		...numToU8(switchEndians(globalData.instanceID)),
		...numToU8(switchEndians(globalData.username.length)),
		...stringToU8(globalData.username),
		...numToU8(switchEndians(globalData.gamePassword.length)),
		...stringToU8(globalData.gamePassword),
		...numToU8(switchEndians(globalData.serverKey.length)),
		...stringToU8(globalData.serverKey),
		...numToU8(switchEndians(globalData.serverKeyTimestamp.length)),
		...stringToU8(globalData.serverKeyTimestamp),
		...numToU8(switchEndians(globalData.coreChecksum)),
		...numToU8(switchEndians(globalData.prototypeListChecksum)),
		...numToU8(switchEndians(globalData.mods.length)),
		...globalData.mods.map(mod => {
			const version = mod.version
				.split(".")
				.map(x=>parseInt(x))
				.map(x=>switchEndians(x))
				.map(x=>numToU8(x)).flat()
			return [
				...numToU8(switchEndians(mod.name.length)),
				...stringToU8(mod.name),
				...version.map(x=>switchEndians(x)).map(x=>numToU8(x)).flat(),
				...numToU8(switchEndians(mod.crc))
			]
		}).flat(),
		0x00 // some padding?
	])

	await listener.send(ConnectionRequest, REMOTE)
}

async function sendClientToServerHeartbeat(flags: number, extra?: number[]) {
	const data = new Uint8Array([
		Math.random() > 0.5 ? 0x06 : 0x06 + 0x20, // ClientToServerHeartbeat identification
		flags,
		...numToU8(switchEndians(globalData.sequenceNumberToSend++)), // sequenceNumber
		...numToU8(2**32 - 1), // nextToRecieveServerTickClosure
		...extra || []
	])
	await listener.send(data, REMOTE)
}

async function sendTransferBlockReqest(blockNumber: number) {
	const sequenceNum = numToU8(switchEndians(blockNumber))
	while (sequenceNum.length < 4) {
		sequenceNum.unshift(0)
	}
	const data = new Uint8Array([
		Math.random() > 0.5 ? 0xc : 0x0c + 0x20, // TransferBlockReqest identification
		...sequenceNum, // sequenceNumber
	])
	await listener.send(data, REMOTE)
}

await sendConnectionRequest()
await sendConnectionRequestReplyConfirm()


let hasNotReReplied = true
for await (const [response] of listener) {
	const type = response[0]
	const typeString = type.toString(16)
	if (typeString.slice(-1) === "7") {
		// ServerToClientHeartbeat
		if (response.includes(0x14) && hasNotReReplied) {
			await sendConnectionRequestReplyConfirm()
			hasNotReReplied = false
		}
	}
	else if (typeString.slice(-1) === "5") {
		// ConnectionAcceptOrDeny
		if (!hasNotReReplied) {
			// pass if it has not replied with a new connection request
			let currentByteIndex = 0
			currentByteIndex += 14 // go to game name length byte
			const gameNameLengthByte = response[currentByteIndex]
			currentByteIndex += gameNameLengthByte + 1 // go over game name length
			const serverHashLength = response[currentByteIndex]
			currentByteIndex += serverHashLength + 1 // skip over to description length
			const descriptionLength = response[currentByteIndex]
			currentByteIndex += descriptionLength + 2 // go to max updates byte
			currentByteIndex += 4 + 8 + 1 // skip over game id, steam id & go to username length byte
			currentByteIndex += response[currentByteIndex] + 2 // go to saving for byte

			currentByteIndex += response[currentByteIndex] + 1 // go to peer info size
			const peerInfoSize = response[currentByteIndex] // the amount of people connected?
			currentByteIndex++ // move to first peer
			for (let i = 0; i < peerInfoSize; i++) {
				currentByteIndex++
				const peerNameLength = response[currentByteIndex]
				currentByteIndex += peerNameLength // skip to next peer
			}
			currentByteIndex += 6 // get to the sequence of what to start sending
			// save the sequence number to start with into a variable
			globalData.sequenceNumberToSend = switchEndians(u8ToNum(response.slice(currentByteIndex, currentByteIndex + 4)))

			await sendClientToServerHeartbeat(0x10, [0x01, 0x03, 0x02]) // send request for map
			// send a reply to the connection request
			setInterval(() => sendClientToServerHeartbeat(0x00), 1/5)
			// TODO: do something to not get disconnected
			setInterval(() => sendTransferBlockReqest(globalData.transferBlockNumber++), 0.5)
			await sendClientToServerHeartbeat(0x10, [0x01, 0x03, 0x02]) // send connected & waiting for map
		}
	}
}