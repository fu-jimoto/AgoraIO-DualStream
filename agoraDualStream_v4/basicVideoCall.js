var client; // Agora client
var localTracks = {
  videoTrack: null,
  audioTrack: null
};
var remoteUsers = {};
// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
};

// the demo can auto join channel with params in url
$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  if (options.appid && options.channel) {
    $("#appid").val(options.appid);
    $("#token").val(options.token);
    $("#channel").val(options.channel);
    $("#join-form").submit();
  }
})

$("#join-form").submit(async function (e) {
  e.preventDefault();
  $("#join").attr("disabled", true);
  try {
    options.appid = $("#appid").val();
    options.token = $("#token").val();
    options.channel = $("#channel").val();
    await join();
    if(options.token) {
      $("#success-alert-with-token").css("display", "block");
    } else {
      $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
      $("#success-alert").css("display", "block");
    }
  } catch (error) {
    console.error(error);
  } finally {
    $("#leave").attr("disabled", false);
  }
})

$("#leave").click(function (e) {
  leave();
})

$("#fallback").click(function (e) {

  fallback();
})


async function join() {
  // create Agora client
  client = AgoraRTC.createClient({ mode: "rtc", codec: "h264" });

  // add event listener to play remote tracks when remote user publishs.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [ options.uid, localTracks.audioTrack, localTracks.videoTrack ] = await Promise.all([
    // join the channel
    client.join(options.appid, options.channel, options.token || null),
    // create local tracks, using microphone and camera
    AgoraRTC.createMicrophoneAudioTrack(),
    AgoraRTC.createCameraVideoTrack({encoderConfig: "480p_1"}),
  ]);
  
  // play local video track
  localTracks.videoTrack.play("local-player");
  $("#local-player-name").text(`localVideo(${options.uid})`);

  //===DualStream===
  // Set the low-quality stream: 120 ~ 120, 120 Kbps.
  await client.setLowStreamParameter({
    width: 120,
    height: 90,
    bitrate: 120,
  });
  //framerate: 15,

  // Enable dual-stream mode.
  await client.enableDualStream().then(() => {
    console.log("enable dual stream success");
  }).catch(err => {
    console.log(err);
  });
  //==================

  // publish local tracks to channel
  await client.publish(Object.values(localTracks));
  console.log("publish success");
}

async function leave() {

  //===DualStream===
  await client.disableDualStream();
  //==================

  for (trackName in localTracks) {
    var track = localTracks[trackName];
    if(track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }

  // remove remote users and player views
  remoteUsers = {};
  $("#remote-playerlist").html("");

  // leave the channel
  await client.leave();

  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  console.log("client leaves channel success");
}

async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {
    const player = $(`
      <div id="player-wrapper-${uid}">
        <p class="player-name">remoteUser(${uid})</p>
        <!--===DualStream===-->
        <button id="hight" onClick=hight(${uid})>Hight</button>
        <button id="low" onClick=low(${uid})>Low</button>
        <select name="fb_option" id="fb_option-${uid}" class="form-select" aria-label="">
        <option value=0>0</option>
        <option value=1 selected >1</option>
        <option value=2>2</option>
        </select>
        <button id="fallback" onClick=fallback(${uid})>FallBack</button>
        <!--===============-->
        <div id="player-${uid}" class="player"></div>
      </div>
    `);
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
}

function handleUserPublished(user, mediaType) {
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

function handleUserUnpublished(user) {
  const id = user.uid;
  delete remoteUsers[id];
  $(`#player-wrapper-${id}`).remove();
}

//===DualStream===
async function hight(uid) {
  console.log("hight:" + uid);
  await client.setRemoteVideoStreamType(uid,0);
}
async function low(uid) {
  console.log("low:" + uid);
  await client.setRemoteVideoStreamType(uid,1);
}
async function fallback(uid){
  var option = parseInt($(`#fb_option-${uid}`).val());
  console.log("fallback:" + "%s" + ":" + "uid:" + "%s",option,uid);

  client.on("stream-type-changed", handleStreamTypeChanged);
  client.on("stream-fallback", handleStreamFallback);

  await client.setStreamFallbackOption(uid, option);
}

function handleStreamTypeChanged(uid, mediaType) {
  console.log("uid:" + "%s" + "medialType:" + "%s",uid, mediaType);
}

function handleStreamFallback(uid,isFallbackOrRecover) {
  console.log("uid:" + "%s" + "medialType:" + "%s", uid,isFallbackOrRecover);
}

async function getStatsDetail(user) {
  for(var i in user){
    console.log(i+":"+user[i]);
  }
}

async function getStats() {
  var user = client.getRemoteVideoStats()
  for(var u in user){
    console.log(u);
    getStatsDetail(user[u]);
  }
}

setInterval(getStats, 10000);
//==================


  
