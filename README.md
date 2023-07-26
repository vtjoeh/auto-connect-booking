# auto-connect-booking


## Automatically connects One Button To Push (OBTP) scheduled meetings for Cisco video devices.  

Purpose: Automatically connects One Button To Push (OBTP) scheduled meetings at the exact meeting start time.  Calendar connector and OBTP are prerequisites. Supports both standard and WebRTC meetings (MS Teams and Google Meet).
By default scheduled calls are disconnected at the end of the meeting.  Adhoc calls overrides the auto-connect of scheduled meeings.  

Note: Auto-connecting calls can be a security risk.  By default in this macro the microphone is muted at the start of a call.  To change set: autoAudioMuteScheduledCalls = false.  

Author:  Joe Hughes
let contact =  'joehughe' + '@' + 'cisco' + '.com' 

