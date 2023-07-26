/*
AutoBookingConnect.js ver 0.1 for Cisco Video devices

Purpose: Automatically connects One Button To Push (OBTP) scheduled meetings at the exact meeting start time.  Calendar connector and OBTP are prerequisites. Supports both standard and WebRTC meetings (MS Teams and Google Meet).
By default scheduled calls are disconnected at the end of the meeting.  Adhoc calls overrides the auto-connect of scheduled meeings.  

Note: Auto-connecting calls can be a security risk.  By default in this macro the microphone is muted at the start of a call.  To change set: autoAudioMuteScheduledCalls = false.  

Author:  Joe Hughes
let contact =  'joehughe' + '@' + 'cisco' + '.com'   
*/

import xapi from 'xapi';

const autoAudioMuteScheduledCalls = true; // audAudioMute (defaut value = true). Mute microphone at the beginning of an auto-connected meeting. 

const autoDisconnectScheduledCalls = true; // autoDisconnect (default value = true). Only disconnects a previously scheduled meeting.  Ad-hoc calls are not disconnected and override the auto-connect feature.  

const retryForBackToBackMeetings = 5000 // (default value = 5000). In milliseconds. Time between back to back meetings, how long to try to connect meeting.  

async function connectToMeeting(id = '', attempts = 0) {
    try {
        const bookings = await xapi.Command.Bookings.List();
        const call = await xapi.Status.Call.get();

        if (call != '') {
            if (attempts === 0) {
                setTimeout(() => { connectToMeeting(id, 1); }, retryForBackToBackMeetings);
            }
            else {
                console.log('Second attempt not allowed if call is still connected after ' + retryForBackToBackMeetings + ' ms.');
            }
        }
        else {
            if (bookings.Booking !== undefined) {
                for (let i = 0; i < bookings.Booking.length; i++) {
                    if (id === bookings.Booking[i].Id) {

                        let callProtocol = bookings.Booking[i].DialInfo.Calls.Call[0].Protocol;

                        if (autoAudioMuteScheduledCalls) xapi.Command.Audio.Microphones.Mute();

                        screenMessage('Autoconnectiong to: ' + bookings.Booking[i].Title);

                        playSound('Dial');

                        if (callProtocol === 'WebRTC') {
                            connectWebRTC(bookings.Booking[i]);
                        }
                        else {
                            makeCall(bookings.Booking[i]);
                        }
                    }
                }
            }
        }

    }
    catch (error) {
        console.error(error);
    }
}

function playSound(sound = "Announcement", time = 1000) {
    xapi.Command.Audio.Sound.Play({ Sound: sound });
    setTimeout(() => xapi.Command.Audio.Sound.Stop(), time);
}

function makeCall(booking) {
    xapi.Command.Dial({
        DisplayName: booking.Title,
        Number: booking.DialInfo.Calls.Call[0].Number,
        BookingId: booking.MeetingId,
        TrackingData: booking.Id
    }
    )
}

function connectWebRTC(booking) {
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
    xapi.Command.WebRTC.Join(connectionObject);
}

async function endBookingCall(id) {
    try {
        const bookings = await xapi.Command.Bookings.List();
        const call = await xapi.Status.Call.get();

        if (call != '') {
            let callbackNumber = call[0].CallbackNumber.match(/(spark:|h323:|sip:)?(.*)/i)[2];;

            for (let i = 0; i < bookings.Booking.length; i++) {
                if (id === bookings.Booking[i].Id) {
                    if (bookings.Booking[i].DialInfo.Calls.Call[0].Number === callbackNumber) {
                        xapi.Command.Call.Disconnect();
                        screenMessage('Call Auto-Disconnected');
                        playSound();
                    }
                }
            }
        }
    }
    catch (error) {
        console.error(error);
    }
}

function screenMessage(message, duration = 8, x = 10000, y = 300) {
    xapi.Command.UserInterface.Message.TextLine.Display({
        Text: message,
        X: x,
        Y: y,
        Duration: duration,
    });
}

function listen() {
    xapi.Event.Bookings.Start.Id.on(id => {
        connectToMeeting(id);
    });

    xapi.Event.Bookings.End.Id.on(id => {
        if (autoDisconnectScheduledCalls) endBookingCall(id);
    })

    xapi.Event.Bookings.StartTimeBuffer.Id.on(() => {
        screenMessage('Autoconnecting next meeting within 5 minutes.', 300);
    })

    xapi.Status.Conference.Call.on(() => {
        setTimeout(() => xapi.Command.UserInterface.Message.TextLine.Clear(), 8000);
    })

    xapi.Event.Bookings.TimeRemaining.on((timeRemaining) => {
        let seconds = timeRemaining.Seconds;
        let minutes = Math.ceil(seconds / 60);
        screenMessage(minutes + ' min. left in meeting.');
        console.log('****' + minutes + ' min. left in meeting.');
    })
}

listen(); 
