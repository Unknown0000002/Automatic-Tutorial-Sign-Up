const qs = require('qs');
const axios = require('axios');
const express = require('express');
axios.defaults.withCredentials = true;
const app = express();
let sessionCookies = {};
let stringCookies = '';
const regex = /^([A-Za-z\-]+?)=(.*?);/g;
const matches = ['study hall', 'quiet homework', 'hw'];
const CronJob = require('cron').CronJob;
const fs = require('fs');
const { promisify } = require('util');
const PORT = 3;
let serverRunning = false;

const fsWriteFile = promisify(fs.writeFile);
const fsReadFile = promisify(fs.readFile);

let cronJob;
let interval;

async function readConfig() {
	return JSON.parse(await fsReadFile('./config.json', { encoding: 'utf-8' }));
}

async function writeConfig(data) {
	return await fsWriteFile('./config.json', JSON.stringify(data, undefined, 5));
}

let personID;

app.set('views', './src/views');
app.set('view engine', 'ejs');
app.use(express.static('./src/static'));
app.use(express.json());

async function login(exit = false, credentials) {
	const { username, password } = await readConfig();
	const reqInfo = {
		appName: 'sanRamon',
		nonBrowser: 'true',
		username: credentials?.username ? credentials.username : username,
		password: credentials?.password ? credentials.password : password,
	};

	const queryData = qs.stringify(reqInfo);

	const res = await axios(
		'https://srvusd.infinitecampus.org/campus/verify.jsp',
		{
			method: 'post',
			data: queryData,
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			withCredentials: true,
		}
	);

	if (res.status !== 200) {
		console.log('Error has occurred');
		if (exit) process.exit(1);
		else return false;
	}

	if (res.data.trim() === '<AUTHENTICATION>password-error</AUTHENTICATION>') {
		console.log('Invalid Credentials');
		if (exit) process.exit(1);
		else return false;
	}

	if (res.data.trim() === '<AUTHENTICATION>captcha</AUTHENTICATION>') {
		console.log(
			'You have gotten the credentials wrong too many times. You will need to fill out a captcha at https://srvusd.infinitecampus.org'
		);
		if (exit) process.exit(1);
		else return false;
	}

	const unparsedCookies = [...res.headers['set-cookie']];

	unparsedCookies.forEach(cookie => {
		const [result] = [...cookie.matchAll(regex)];

		sessionCookies[result[1]] = result[2];
	});

	const requiredCookies = [
		'JSESSIONID',
		'sis-cookie',
		'portalApp',
		'selection',
		'appName',
		'tool',
	];

	Object.entries(sessionCookies).forEach(([key, value]) => {
		requiredCookies.forEach(required => {
			if (key === required) {
				stringCookies = `${stringCookies}${key}=${value};`;
			}
		});
	});

	let config = {
		method: 'get',
		url: 'https://srvusd.infinitecampus.org/campus/resources/my/userAccount',
		headers: {
			Cookie: stringCookies,
		},
	};

	const userRes = await axios(config);

	personID = userRes.data.personID;

	return true;
}

async function signUp(sessionID, offeringID) {
	const data = JSON.stringify({
		personID: Number(personID),
		responsiveSessionID: Number(sessionID),
		calendarID: 1485,
		responsiveOfferingID: Number(offeringID),
	});

	const config = {
		method: 'post',
		url: 'https://srvusd.infinitecampus.org/campus/resources/prism/portal/responsiveSchedule/update',
		headers: {
			'Content-Type': 'application/json',
			Cookie: stringCookies,
		},
		data: data,
	};

	const res = await axios(config);

	return res.success;
}

async function run() {
	const { enableLogging, listed } = await readConfig();
	try {
		const credentialsRes = await axios(
			`https://srvusd.infinitecampus.org/campus/resources/prism/portal/responsiveSchedule?calendarID=1485&structureID=1472&personID=${personID}`,
			{
				method: 'get',
				headers: {
					Cookie: stringCookies,
				},
			}
		);

		const schedule = credentialsRes.data;

		if (enableLogging) {
			console.log('--------------\n');

			console.log(`At: ${new Date()}\n`);
		}

		if (schedule && schedule.length <= 0 && enableLogging) {
			console.log('No Sessions Found.\n');
		}

		for (const session of schedule) {
			if (session.sessionOpen && Array.isArray(session.offerings)) {
				const teachers = [];

				for (const teacher of listed) {
					for (const offering of session.offerings) {
						if (offering.teacherDisplay === teacher) {
							teachers.push({
								teacher,
								offering,
								signedUp: offering.rosterID !== 0 ? true : false,
							});
						}
					}
				}

				let signedUp = false;

				for (const {
					signedUp: signedUpAlready,
					offering,
					teacher,
				} of teachers) {
					if (signedUpAlready && signedUp === false) {
						signedUp = true;
						if (enableLogging) {
							console.log(
								`Already signed up to ${teacher} for ${session.sessionName}.\n`
							);
						}
						break;
					}

					if (
						!offering.teacherRequest &&
						offering.currentStudents < offering.maxStudents &&
						signedUp === false
					) {
						let isMatching = false;

						for (const matcher of matches) {
							if (
								new RegExp(matcher, 'g').test(
									offering.responsiveOfferingName.toLowerCase()
								)
							) {
								isMatching = true;
							}
						}

						if (isMatching) {
							signedUp = true;
							await signUp(
								session.responsiveSessionID,
								offering.responsiveOfferingID
							);
							if (enableLogging)
								console.log(
									`Signed Up to ${teacher} for ${session.sessionName}\n.`
								);
							break;
						}
					}
				}
			} else {
				if (enableLogging) {
					console.log(`${session.sessionName} is closed.\n`);
				}
			}
		}

		if (enableLogging) console.log('--------------\n');
	} catch (error) {
		console.log('Error has occurred. Try again later.');

		if (error?.response?.status === 401) {
			return restart();
		}
	}
}

async function start() {
	const { username, password, listed } = await readConfig();

	if (!username || !password) {
		console.log(
			'There is no password, username or both entered. To continue, enter valid credentials.\n'
		);

		process.exit(1);
	}

	if (listed && listed.length > 0) {
		let result;
		try {
			result = await login();
		} catch (error) {
			console.log('login error');
			return stop();
		}

		if (!result) {
			return stop();
		}

		serverRunning = true;

		cronJob = new CronJob(
			'0 0 * * * *',
			run,
			null,
			true,
			'America/Los_Angeles'
		);
		cronJob.start();

		interval = setInterval(run, 30000);

		console.log('Successfully started server.\n');
	} else {
		console.log(
			'The list contains 0 teachers, so ending process. To continue, add teachers to the list.\n'
		);
		process.exit(1);
	}
}

function stop() {
	if (cronJob) {
		cronJob.stop();
		cronJob = undefined;
	}

	if (interval) {
		clearInterval(interval);
		interval = undefined;
	}
	serverRunning = false;
	console.log('Successfully stopped server.\n');
}

async function restart() {
	console.log('Restarting Server...\n');
	stop();
	await start();
	console.log('Successfully Restarted Server\n');
}

app.get('/', async (req, res) => {
	const { username, password, enableLogging, listed } = await readConfig();
	res.render('index', {
		username,
		password,
		enableLogging,
		listed: JSON.stringify(listed),
		serverRunning: serverRunning ? 'true' : 'false',
	});
});

app.put('/api/submit/list', async (req, res) => {
	const teachers = req.body;

	teachers.forEach(teacher => teacher.trim());

	const contents = await readConfig();

	if (!teachers) {
		return res.status(403).json();
	}

	contents.listed = [...new Set(teachers)];

	await writeConfig(contents);

	return res.status(200).json({ success: true });
});

app.put('/api/submit/credentials', async (req, res) => {
	const { username, password, enableLogging } = req.body;

	const errors = [];

	if (!username) {
		errors.push('Please enter an username.');
	}

	if (!password) {
		errors.push('Please enter a password.');
	}

	if (errors.length >= 1) {
		return res.status(403).json({ error: true, errors });
	}

	// const result = await login(false, { username, password });

	// if (result) {
	const contents = await readConfig();
	contents.username = username;
	contents.password = password;
	contents.enableLogging = Boolean(enableLogging);

	await writeConfig(contents);

	if (stringCookies) {
		const result = await login();
		if (!result) stop();
	}

	return res.status(200).json({ success: true });
	// }

	// return res.status(403).json({ invalid: true });
});

app.post('/api/startServer', (req, res) => {
	if (cronJob || interval) {
		return res.status(403).json();
	}

	start();

	res.status(200).json({ success: true });
});

app.post('/api/stopServer', (req, res) => {
	stop();

	res.status(200).json({ success: true });
});

app.post('/api/endProcess', (req, res) => {
	process.exit(1);
});

app.listen(PORT, () => console.log(`Go to http://localhost:${PORT}`));
