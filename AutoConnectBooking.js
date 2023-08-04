/*
AutoBookingConnect.js ver 0.1.1 for Cisco Video devices

Purpose: Automatically connects One Button To Push (OBTP) scheduled meetings at the exact meeting start time.  Calendar connector and OBTP are prerequisites. Supports both standard and WebRTC meetings (MS Teams and Google Meet).

- Supports standard and WebRTC meetings.
- Supports back-to-back meetings.  
- Has a 30-second countdown timer shown on screen before connecting to the next meeting. Setting is configurable. 
- Has 5, 4, 3, 2 and 1 minute warning before auto-disconnecting from the meeting.  These messages are triggered by the xapi.Event.Bookings.TimeRemaining.Seconds sent from Control Hub.  
- Will disconnect ad-hoc meetings for scheduled meetings.  Setting is configurable so ad-hoc calls can take precedent over scheduled calls.  
- Ringing sound to indicate that a call is auto-connecting. Setting is configurable.  
- Works with OBTP and extending booking feature.  
- Tested with Webex cloud registered devices using O365 hybrid calendar connector. 

Note: Auto-connecting calls can be a security risk.  By default, the macro mutes the microphone at the start of a call.  To change set: autoAudioMuteScheduledCalls = false.  



Author:  Joe Hughes
let contact =  'joehughe' + '@' + 'cisco' + '.com'   
*/

import xapi from 'xapi';

const autoAudioMuteScheduledCalls = true; // Defaut value: true. Mute microphone at the beginning of an auto-connected meeting. 

const autoDisconnectScheduledCalls = true; // Defualt value: true. Disconnects scheduled meeting at end of meeting time.  Ad-hoc calls are not disconnected.   

const autoDisconnectAdHocCalls = true; // Default value: true.  Disconnect both ad-hoc calls or scheduled calls before the start of the next scheduled meeting.  

const makeSounds = true; // Default value: true. Makes a ringing connecting sound when connecting and a beep when disconnecting. 

const showMessages = true; // Default value: true.  Shows a message at 5 minutes before a meeting starts and at minutes 5, 4, 3 , 2, 1 before the end of the meeting (dependent on cloud commands). Show start countdown if enabled. 

const screenMessageSeconds = 7 // Seconds. Default value: 7.  How long to showMessages above. Does not include countdown timer. 

const showCountDownStartTimer = true; // Default value: true. Requires showMessages also be true. 

const countDownStartTimer = 30 // Seconds.  Default = 30; 

const showCountDownStartTimerBeforeNonCalls = false // Default = false.  If a meeting is not a call, show the count down timer before meeting start.  

const retryForBackToBackMeetings = 4 // In seconds. Default Value: 4.  For back-to-back calls how long to retry before attempting to connect the meeting while the first call disconnects.  

const maxAttemptsForRetry = 3;  // For back-to-back meeting, how many times to retry connecting the 2nd meeting. 

/************************************/

let nextScheduledMeeting = {}; // keep the next scheduled call in memory to make decisions on showing timers or auto-disconnecting. 

let currentCallNextMeeting = false; // keep track if the current call is the next meeting. 

let isNextMeetingACall = false; // determine if the next meeting is a call. Don't show timer for non-calls. 

let theTimer = {};  // Countdown Start Timer 

function makeCall(booking) {  // Connect Spark calls. 
  xapi.Command.Dial({
    DisplayName: booking.Title,
    Number: booking.DialInfo.Calls.Call[0].Number,
    BookingId: booking.MeetingId,
    TrackingData: booking.Id
  })
  console.info('Auto connect meeting. Title: ', booking.Title, ' URL: ', booking.DialInfo.Calls.Call[0].Number);
}

function connectWebRTC(booking) {  // Connect WebRTC - MS Teams or Google Meetings 
  let meetingType = 'MSTeams';

  if (booking.MeetingPlatform === "GoogleMeet") {
    meetingType = "GoogleMeet";
  }

  let connectionObject = {
    BookingId: booking.MeetingId,
    Title: booking.Title,
    Type: meetingType,
    Url: booking.DialInfo.Calls.Call[0].Number
  }
  console.info('Auto connect WebRTC meeting. Title: ', booking.Title, ' Type: ', meetingType, ' URL: ', booking.DialInfo.Calls.Call[0].Number)
  xapi.Command.WebRTC.Join(connectionObject);
}

function screenMessage(message, duration = screenMessageSeconds, x = 10000, y = 300) {
  if (!showMessages) return;
  xapi.Command.UserInterface.Message.TextLine.Display({
    Text: message,
    X: x,
    Y: y,
    Duration: duration,
  }).catch(error => {
    console.error('error screenMessage()', error);
  });
}

function playSound(sound = "Announcement", time = 1000) {
  if (!makeSounds) return;
  xapi.Command.Audio.Sound.Play({ Sound: sound });
  setTimeout(() => xapi.Command.Audio.Sound.Stop(), time);
}

async function getBookingFromId(id) {
  let bookings = await xapi.Command.Bookings.List();
  try {
    if (bookings.Booking !== undefined) {
      for (let i = 0; i < bookings.Booking.length; i++) {
        if (id === bookings.Booking[i].Id) {
          if (bookings.Booking[i].DialInfo.Calls.Call[0].Number !== '') {
            return bookings.Booking[i];
          } else {
            return 'NoMeetingNumber';
          }
        }
      }
    } else {
      console.error('getBookingFromId(): No booking available');
    }
  }
  catch (error) {
    console.error(error);
  }
}

async function connectToMeeting(id, attempts = 0) {
  try {
    await disconnectAdHocCall();
    const call = await xapi.Status.Call.get();
    const booking = await getBookingFromId(id);

    if (call.length) {  // Check for an active call, then reattempt call.  
      if (attempts < maxAttemptsForRetry) {
        attempts += 1;
        setTimeout(() => { connectToMeeting(id, attempts); }, retryForBackToBackMeetings * 1000);
      }
      else {
        console.info('Max attempt retry exceeded. attempts = ', attempts);
      }
    }
    else if (booking !== 'NoMeetingNumber') {
      const callProtocol = booking.DialInfo.Calls.Call[0].Protocol;

      if (autoAudioMuteScheduledCalls) xapi.Command.Audio.Microphones.Mute();

      screenMessage('Auto-connect: ' + booking.Title);
      playSound('Dial');

      if (callProtocol === 'WebRTC') {
        connectWebRTC(booking);
      }
      else {
        makeCall(booking);
      }
    }
  }
  catch (error) {
    console.error(error);
  }
}

async function endBookingCall(id) {
  try {
    const call = await xapi.Status.Call.get();
    const booking = await getBookingFromId(id);
    let callbackNumber;

    if (booking != 'NoMeetingNumber' && call.length) {
      callbackNumber = call[0].CallbackNumber;
      callbackNumber = callbackNumber.match(/(spark:|h323:|sip:)?(.*)/i)[2];
    }
    else {
      return 'No active call or NoMeetingNumber';
    }

    if (booking.DialInfo.Calls.Call[0].Number === callbackNumber) {
      xapi.Command.Call.Disconnect();
      console.info('Disconnected scheduled call. callbackNumber: ', callbackNumber, ' Meeting Title: ', booking.Title);
      screenMessage('Call Auto-Disconnected');
      playSound();
      return 'CallDisconnecting';
    }
  }
  catch (error) {
    console.error(error);
  }
}

async function startTimeBufferMessage(id) {
  try {
    const booking = await getBookingFromId(id);

    if (booking != 'NoMeetingNumber') {
      setTimeout(() => {
        let startTime = new Date(booking.Time.StartTime);
        let now = new Date();
        let minutes = Math.round(((startTime - now) / 1000 / 60));
        countDown(startTime);
        screenMessage('Next meeting will auto-connect in ' + minutes + ' minutes.<br>Meeting: ' + booking.Title);
      }, 5)  // adding some buffer time in case Event.Bookings.End.Id for next meeting overlaps overlaps.  
    }
  }
  catch (error) {
    console.error(error);
  }
}

function countDown(startTime) {
  if (!showCountDownStartTimer || !showMessages) return;
  if(!isNextMeetingACall && !showCountDownStartTimerBeforeNonCalls) return; 

  let now = new Date();
  let seconds = Math.ceil(((startTime - now) / 1000));
  let formattedTime = formatTime(seconds);

  if (seconds > 0) {
    if (seconds <= countDownStartTimer) {
      if (!currentCallNextMeeting) {
        screenMessage('Next meeting: ' + formattedTime + ' s', 2);
      }
    }
    theTimer = setTimeout(() => { countDown(startTime) }, 1000);
  }
}

function formatTime(time) {
  let min = Math.floor(time / 60);
  if (min < 10) min = `0${min}`;
  let sec = time % 60;
  if (sec < 10) sec = `0${sec}`;
  return `${min}:${sec}`;
}

async function onEventBookingsTimeRemaining(timeRemaining) {
  let minutes = Math.round(timeRemaining.Seconds / 60);
  
  await updateCurrentCallNextMeeting();
  if (!currentCallNextMeeting) {
    screenMessage(minutes + ' min. left in meeting.');
  }
}

async function disconnectAdHocCall() {
  try {

    if (!autoDisconnectAdHocCalls) return; // 'autoDisconnectAdHocCalls = true'

    if (currentCallNextMeeting) return; // 'Current call is the next meeting do nothing' 

    const call = await xapi.Status.Call.get();
    if (call.length) {
      console.info('Disconnecting call for next meeeting.  Call.id: ', call[0].id, ' CallbackNumber: ', call[0].CallbackNumber);
      xapi.Command.Call.Disconnect({ CallId: call[0].id });
      screenMessage('Auto-disconnect for next meeting');
      playSound();
      return;
    }
  }
  catch (error) {
    console.error(error);
  }
}

async function isCurrentCallNextMeeting() {
  try {

    const call = await xapi.Status.Call.get();

    if ('DialInfo' in nextScheduledMeeting && call.length) {  // Check to see if there is a nextScheduledMeeting or current call. 
      let callbackNumber = call[0].CallbackNumber;
      callbackNumber = callbackNumber.match(/(spark:|h323:|sip:)?(.*)/i)[2];;
      if (nextScheduledMeeting.DialInfo.Calls.Call[0].Number === callbackNumber) {
        clearTimeout(theTimer);
        setTimeout(() => xapi.Command.UserInterface.Message.TextLine.Clear(), 3000);
        currentCallNextMeeting = true;
      } else {
        currentCallNextMeeting = false;
      }
    } else {
      currentCallNextMeeting = false;
    }
  }
  catch (error) {
    console.error(error);
  }
}

async function getNextScheduledMeeting() {
  if (!showCountDownStartTimer || !showMessages) return;

  try {
    let candidateTime = new Date();
    candidateTime.setDate(candidateTime.getDate() + 1);

    let now = new Date();
    let candidateDateFound = false;
    let nextScheduledCallCandidate = {};
    let bookings = await xapi.Command.Bookings.List();
    if (bookings.Booking !== undefined) {
      for (let i = 0; i < bookings.Booking.length; i++) {
        let bookingTime = new Date(bookings.Booking[i].Time.StartTime)
        if (now < bookingTime && bookingTime < candidateTime) {
          candidateTime = bookingTime;
          candidateDateFound = true;
          nextScheduledCallCandidate = bookings.Booking[i];
        }
      }
    }

    if (candidateDateFound) {
      nextScheduledMeeting = nextScheduledCallCandidate;
      if ('DialInfo' in nextScheduledMeeting && nextScheduledMeeting.DialInfo.Calls.Call[0].Number !== ''){  
        isNextMeetingACall = true;  
        
      } else {
        isNextMeetingACall = false;
      }
      clearTimeout(theTimer);
      countDown(candidateTime);
    } else {
      nextScheduledMeeting = {};
      isNextMeetingACall = false; 
      clearTimeout(theTimer);
    }
  }
  catch (error) {
    console.error(error);
  }
}
async function updateCurrentCallNextMeeting() {
  await getNextScheduledMeeting();
  await isCurrentCallNextMeeting();
}

function listen() {
  xapi.Event.Bookings.Start.on(start => {
    connectToMeeting(start.Id);
  });

  xapi.Event.Bookings.End.on(end => {
    if (autoDisconnectScheduledCalls) endBookingCall(end.Id);
  })

  xapi.Event.Bookings.StartTimeBuffer.on(startTimeBuffer => {
    startTimeBufferMessage(startTimeBuffer.Id);
  })

  xapi.Status.Call.Status.on((status) => {
    if (status === 'Connected') {
      updateCurrentCallNextMeeting();
    }
  })

  xapi.Event.CallDisconnect.on(() => {
    updateCurrentCallNextMeeting();
  })

  xapi.Event.Bookings.TimeRemaining.on((timeRemaining) => {
    onEventBookingsTimeRemaining(timeRemaining);
  })

  xapi.Event.Bookings.Updated.on(() => {
    updateCurrentCallNextMeeting();
  })
}

updateCurrentCallNextMeeting()

listen();

