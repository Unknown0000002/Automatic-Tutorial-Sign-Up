const qs = require('qs');
const axios = require('axios');
const express = require('express');
axios.defaults.withCredentials = true;
const app = express();
let sessionCookies = {};
let stringCookies = '';
const regex = /^([A-Za-z\-]+?)=(.*?);/g;
const { username, password, listed, enableLogging } = require('./config.json');
const matches = ['study hall', 'quiet homework'];
const CronJob = require('cron').CronJob;
let personID;

async function login() {
	const reqInfo = {
		appName: 'sanRamon',
		nonBrowser: 'true',
		username,
		password,
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
		process.exit(1);
	}

	if (res.data.trim() === '<AUTHENTICATION>password-error</AUTHENTICATION>') {
		console.log('Invalid Credentials');
		process.exit(1);
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

async function signUp(offeringID) {
	var data = JSON.stringify({
		personID: personID,
		responsiveSessionID: 1608,
		calendarID: 1485,
		responsiveOfferingID: Number(offeringID),
	});

	var config = {
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

		for (const session of schedule) {
			if (session.sessionOpen) {
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
								`Already signed up to ${teacher} for ${session.sessionName}`
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
							await signUp(offering.responsiveOfferingID);
							if (enableLogging)
								console.log(
									`Signed Up to ${teacher} for ${session.sessionName}`
								);
							break;
						}
					}
				}
			} else {
				if (enableLogging) {
					console.log(`${session.sessionName} is closed.`);
				}
			}
		}
	} catch (error) {
		console.log('no success');
		process.exit(1);
	}
}

async function start() {
	await login();

	new CronJob('* * 12 * * *', run, null, true, 'America/Los_Angeles').start();

	setInterval(run, 30000);
}

start();

app.listen(4);
