// Streaming filters retain only the previous sample; timestamps and speed stay intact.
export const audioPresets={
  original:{label:'元のまま'},
  cassette:{label:'カセット',sampleRate:32000,bitrate:64000,low:100,high:4500,drive:1.3,bits:12,hiss:.001},
  vhs:{label:'VHS',sampleRate:24000,bitrate:48000,low:150,high:4500,drive:1.6,bits:10,hiss:.0015},
  radio:{label:'古いラジオ',sampleRate:16000,bitrate:32000,low:300,high:2800,drive:2,bits:8,hiss:.002},
};
export class RetroAudioProcessor{
  constructor(mode,seed=0){this.preset=audioPresets[mode];if(!this.preset?.sampleRate)throw new Error('不明な音声加工設定です。');this.seed=seed|0;this.reset();}
  reset(){this.previous=0;this.hp=0;this.lp=0;this.lp2=0;this.nextTime=null;}
  process(buffer,timestamp){
    if(this.nextTime!==null&&Math.abs(timestamp-this.nextTime)>.05)this.reset();
    const p=this.preset,rate=buffer.sampleRate;
    const out=new AudioBuffer({length:buffer.length,sampleRate:rate,numberOfChannels:1}),data=out.getChannelData(0);
    const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
    const hpAlpha=1/(1+2*Math.PI*p.low/rate),lpAlpha=1-Math.exp(-2*Math.PI*p.high/rate),steps=2**(p.bits-1);
    const first=Math.round(timestamp*rate);
    for(let i=0;i<data.length;i++){
      let x=0;for(const channel of channels)x+=channel[i]/channels.length;
      this.hp=hpAlpha*(this.hp+x-this.previous);this.previous=x;
      this.lp+=lpAlpha*(this.hp-this.lp);this.lp2+=lpAlpha*(this.lp-this.lp2);
      let hash=Math.imul((first+i)^this.seed,1597334677);hash=Math.imul(hash^(hash>>>16),2246822507);
      const noise=((hash>>>0)/4294967296*2-1)*p.hiss;
      data[i]=Math.max(-.95,Math.min(.95,Math.round(Math.tanh(this.lp2*p.drive)/p.drive*steps)/steps+noise));
    }
    this.nextTime=timestamp+buffer.length/rate;return out;
  }
  dispose(){this.reset();}
}
