# auto-connect-booking


## Automatically connects One Button To Push (OBTP) scheduled meetings for Cisco video devices.  

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

