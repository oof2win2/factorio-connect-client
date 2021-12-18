const FACTORIO_VERSION = "1.1.49.59227" as const;
const REMOTE_ADDR = "144.76.101.206" as const;
const REMOTE_PORT = 39000 as const;
// const version = FACTORIO_VERSION
//   .split(".")
//   .map((x) => parseInt(x));
const version = [1, 1, 49, 59227] as const;

const listener = Deno.listenDatagram({
	hostname: "0.0.0.0",
	port: 39000,
	transport: "udp",
  });


async function sendConnectionAttempt() {
	// connection request format is:
	// flags: 9 bytes, 0x02
	// clientApplicationVersion (Factorio version + build)
	// connectionRequestIDGeneratedOnClient. maybe random values?

	const ConnectionRequest = new Uint8Array([0x02, ...version, 1520080099])

	return await listener.send(ConnectionRequest, {
		hostname: REMOTE_ADDR,
		port: REMOTE_PORT,
		transport: "udp",
	})
}

console.log(new Uint8Array([0x02, ...version, 1520080099]), await sendConnectionAttempt())


// TODO: figure out something to do with the response the server sends
for await (const [response] of listener) {
	console.log(Array.from(response.values()).map(x => x.toString(16).padStart(2, "0")))
}