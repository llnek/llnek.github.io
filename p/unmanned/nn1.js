/* Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright © 2025, Kenneth Leung. All rights reserved. */

;(function(window,UNDEF){

  "use strict";

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  const int=Math.floor;
  const sin=Math.sin;
  const cos=Math.cos;
  const PI2= Math.PI*2;

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  function scenes(Mojo){

    const {Sprites:_S,
           Scenes:_Z,
           FX:_F,
           Input:_I,
           Game:_G,
           Ute2D:_U,
           v2:_V,
           math:_M,
           ute:_,is}=Mojo;

    ////////////////////////////////////////////////////////////////////////////
    const GA= window["io/czlab/mcfud/algo/ChromoGA"]();
    const NN= window["io/czlab/mcfud/algo/NNet"]();
    const Core= window["io/czlab/mcfud/core"]();

    const Params=GA.config({
    });

    ////////////////////////////////////////////////////////////////////////////

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const
      UI_FONT=Mojo.DOKI_LOWER,
      SplashCfg= {
        title:"Unmanned Lander",
        clickSnd:"click.mp3",
        action: {name:"PlayGame"}
      };

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const playClick=()=> Mojo.sound("click.mp3").play();
    const CLICK_DELAY=343;

    const OBJ_SHIP=1;
    const OBJ_HILL=2;
    const OBJ_GROUND=4;
    const OBJ_SITE=8;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const TWO_PI=Math.PI * 2;
    const GRAVITY= 1/300;// 1/150;//1/100;//1/60;//1.63/60;
    const THRUST=  -4;//-2;// -10; 350
    const ROTATION= 3 / 60;
    const MASS= 100;
    const MAX_ROTATION = Math.PI/2;

    const MAX_AIR_TIME=12600;//3.5mins
    //const MAX_AIR_TIME=21600;//5mins

    const BIG_NUMBER=9999999;

    const ROTATION_TOLERANCE=     Math.PI/16;
    const SPEED_TOLERANCE=        1.5;
    const DIST_TOLERANCE=         15.0;

    const POPSIZE=30;

    const INPUTS=8;
    const OUTPUTS=4;

    ////////////////////////////////////////////////////////////////////////////
    function Terrain(self,K,out){
      let maxH=int(Mojo.height*0.4);
      let minH= int(maxH*0.25);
      let hoffset=10*K;
      let s,pad=5,N=10;
      let w=Mojo.width/N;
      let vcolor=_S.color("#906908");
      let pcolor=_S.color("#cbcb02");
      let T=[0.1,0.24,0.24,0.24,0.24,0.24,0.35,0.35,0.35,0.35];
      let V=[0,0,0.2,0.5,0,0.0,0.0,1.2,1.2,0];
      _.assert(V.length==T.length && T.length==N,"bad terrain");
      for(let h, i=0;i<N;++i){
        h=T[i]* maxH;
        s=_S.rect(w,h,vcolor,vcolor);
        s.m5.type=OBJ_GROUND;
        _S.uuid(s,`ground#${i}`);
        s.x=w*i;
        s.y=Mojo.height-hoffset-s.height;
        out.push(T[i]=self.insert(s,true));
      }
      for(let dx,dy,z,x,h, i=0;i<N;++i){
        h=V[i]* maxH;
        z=0;
        dy=0;
        dx=0;
        if(h>0){
          x=w*i;
          if((i+1<N) && V[i]==V[i+1]){
            z=w;
          }/*
          if(T[i].height>T[i-1].height){
            dy=T[i].height-T[i-1].height;
            dx= -dy;
          }*/
          s=_S.triangle(w+z,h,0.5,vcolor,vcolor);
          s.m5.type=OBJ_HILL;
          _S.uuid(s,`hill#${i}`);
          s.x=x+dx;
          s.y=Mojo.height-hoffset-s.height-T[i].height + dy;
          out.push(self.insert(s,true));
          if(z>0)i++;
        }
      }
      let gc=_S.color("#739b08");
      let g=_S.rect(Mojo.width,hoffset,gc,gc);
      g.y=Mojo.height-g.height;
      self.insert(g);
      /////
      let ps=_S.rect(T[pad].width/2,10,pcolor,pcolor);
      _S.uuid(ps,"landing_pad");
      ps.m5.type=OBJ_SITE;
      _S.centerAnchor(ps);
      ps.x=T[pad].x+T[pad].width/2;
      ps.y=T[pad].y-ps.height/2;
      out.push(self.insert(ps,true));
      _.inject(_G,{
        obstacles:out,
        target:ps
      });
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function checkLanding(s,dist,speed){
      if(dist< DIST_TOLERANCE &&
         speed < SPEED_TOLERANCE &&
         Math.abs(s.rotation) < ROTATION_TOLERANCE){
        s.g.score= BIG_NUMBER;
        s.g.landed=true;
        _G.winner=s;
      }
      return s.g.landed;
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function calcScore(s){
      let dx= Math.abs(_G.target.x-s.x);
      let dy= Math.abs(_G.target.y-s.y);
      let distX = Mojo.width/(1+dx);
      let distY = Mojo.height/(1+dy);
      let speed = s.g.calcSpeed();
      let fitAirTime = s.g.tickCount/MAX_AIR_TIME;
      let rotFit = Math.abs(ROTATION_TOLERANCE  - s.rotation);
      let speedFit= Math.abs(SPEED_TOLERANCE - speed);
      let dist =s.g.calcDistToGo();
      if(!checkLanding(s,dx,speed)){
        s.g.score= 1000* distX + 1000* distY - 5000 * fitAirTime - 5000 * rotFit - 5000*speedFit;
      }
      if(dist<100 && speed<2*SPEED_TOLERANCE){
        s.g.score += 500000;
      }
      return s.g.score;
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function testForImpact(s){
      _G.obstacles.find(o=>{
        if(_S.hit(o,s)){
          s.m5.dead=true;
          s.g.score= -1500000;
          if(o.m5.uuid=="landing_pad"){
            checkLanding(s, Math.abs(_G.target.x - s.x), s.g.calcSpeed());
            if(!s.g.landed) s.g.score=888;
          }
          return true;
        }
      });
      return s.m5.dead;
    }

    ////////////////////////////////////////////////////////////////////////////
    /**/
    function Ship(self,K,g){
      let w= _S.sprite("unmanned.png").height,
          s=_S.sprite(_S.frames("unmanned.png",w,w)),
          k= 0.6*_G.target.width/s.width;
      _S.centerAnchor(_S.scaleBy(s,k,k));
      s.rotation= Math.PI/3;
      s.m5.vel[0]=_.rand() * 2;
      s.m5.vel[1]=0;
      s.m5.mass=MASS;
      s.m5.type=OBJ_SHIP;
      s.m5.cmask=OBJ_HILL | OBJ_GROUND | OBJ_SITE;
      s.g.brain=g.getGeneAt(0);
      s.g.score=0;
      s.g.tickCount=0;
      s.g.landed=false;
      s.g.look=function(){
        let dist=this.calcDistToGo();
        let speed= this.calcSpeed();
        return [ s.x/Mojo.width, s.y/Mojo.height, _G.target.x/Mojo.width, _G.target.y/Mojo.height, s.rotation, s.m5.vel[1], speed, dist ];
      };
      s.g.think=function(inputs){
        return s.g.brain.update(inputs);
      };
      s.g.calcDistToGo=function(){
        let x= Math.abs(_G.target.x-s.x),y=Math.abs(_G.target.y-s.y);
        return Math.sqrt(x*x+y*y);
      }
      s.g.calcSpeed=function(){
        return Math.sqrt(s.m5.vel[0]*s.m5.vel[0]+s.m5.vel[1]*s.m5.vel[1]);
      }
      s.g.update=function(outputs, dt){
        if(this.landed){ return false; }
        s.m5.vel[1] += GRAVITY;
        s.m5.showFrame(0);
        if(outputs[0]> 0.5){}
        if(outputs[1]>0.5){//rotl
          s.rotation= (s.rotation + ROTATION) <= MAX_ROTATION ? ROTATION : Math.max(MAX_ROTATION - s.rotation, 0);
        }
        if(outputs[2]>0.5){//rotr
          s.rotation= (s.rotation - ROTATION) >= -MAX_ROTATION ? -ROTATION : Math.max(-MAX_ROTATION + s.rotation, 0);
        }
        if(outputs[3]>0.5){//fire
            let a = THRUST/s.m5.mass;
            s.m5.vel[0] += a * sin(s.rotation);
            s.m5.vel[1] += a * cos(s.rotation);
            this.showJet = true;
            s.m5.showFrame(1);
        }
        if(_M.fuzzyZero(s.m5.vel[0]) && !_M.fuzzyZero(_G.target.x-s.x)){
          s.m5.vel[0] = _.rand()*2;
        }
        s.x += s.m5.vel[0];
        s.y += s.m5.vel[1];
        this.tickCount += 1;
        this.showJet = false;
        if(s.x > Mojo.width){
          s.g.score= -99999;
          s.m5.dead=true;
        }
        else if(s.x < 0){
          s.g.score= -99999;
          s.m5.dead=true;
        }
        else if(s.y < 0){
          s.g.score= -99999;
          s.m5.dead=true;
        }
        else if(s.g.tickCount >MAX_AIR_TIME){
          //3 mins, too long
          s.g.score= -999999;
          s.m5.dead=true;
        }else if(testForImpact(s) && !this.landed){
          calcScore(s);
        }
      };
      s.x=Mojo.width*0.1;
      s.y=s.height*1.2;
      return self.insert(s,true);
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
		class ChromoNNet extends GA.Chromosome{
			#score;
			constructor(nn, calc, target){
				super(nn, calc, target);
				this.recalcScore();
			}
			getScore(){ return this.#score }
			updateScore(s){ this.#score=s; return this; }
			cmpScore(s){ return this.#score>s ? 1 : (this.#score<s? -1 : 0) }
			clone(){
				let [f,t]= this.getScoreCalcInfo();
				return new ChromoNNet(this.copyGenes(), f, t);
			}
      copyGenes(){
        return [this.getGeneAt(0).clone()];
      }
			compareTo(other){
				return this.cmpScore(other.getScore());
			}
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function _crossOverFunc(p1,p2){
      let a= p1.getGeneAt(0).toJSON();
      let b= p2.getGeneAt(0).toJSON();
      if(_.rand() < Params.crossOverRate){
        let t, [p1,p2] = _.randSpan(a.nodes);
        for(let i=p1; i<p2; ++i){
          t= a.nodes[i].bias;
          a.nodes[i].bias= b.nodes[i].bias;
          b.nodes[i].bias=t;
        }
      }
      let new_a= [NN.NeuralNet.fromJSON(a)];
      let new_b= [NN.NeuralNet.fromJSON(b)];
      return [new_a, new_b];
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function calcFit(genes){ return 0; }
    function _createFunc(arg){
      return arg ? new ChromoNNet(arg,calcFit) :
        new ChromoNNet([new NN.NeuralNet(INPUTS,OUTPUTS,{
          layers:[
            {size:20}
          ]
        })],calcFit);
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function _mutateValue(x){ return x*(1 + ((_.rand() - 0.5) * 3 + _.rand() - 0.5)); }
    function _mutateFunc(genes){
      let nn= genes[0];
      nn.iterNodes(n=>{
        if(_.rand() < Params.mutationRate)
          n.setBias(_mutateValue(n.getBias()));
        n.iterOutLinks(k=>{
          if(_.rand()< Params.mutationRate)
            k.weight= _mutateValue(k.weight);
        });
      });
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    _Z.scene("PlayGame",{
      setup(){
        const self=this,
              K=Mojo.getScaleFactor();
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        _.inject(this.g,{
          initTerrain(){
            Terrain(self,K,[])
          },
          isItEnd(){
            return _G.winner || this.ships.every(b=> b.m5.dead)
          },
          initLevel(){
            this.waitNextWave=0;
            this.bestCurScore=0;
            this.ships=[];
            this.neatObj= new GA.ChromoGA(POPSIZE, { create:_createFunc, mutate:_mutateFunc, crossOver:_crossOverFunc });
            this.ships.forEach(b=> _S.remove(b));
            this.ships= this.neatObj.createPhenotypes().map(g=> Ship(self,K,g));
            this.resetNext(true);
          },
          resetNext(skip){
            this.waitNextWave=30;
            this.bestCurScore=0;
            if(!skip){
              this.neatObj.epoch(this.ships.reduce((acc,s)=>{
                return acc.push(s.g.score) && _S.remove(s) && acc
              }, []));
              this.ships= this.neatObj.createPhenotypes().map(g=> Ship(self,K,g));
            }
          },
          tick(dt){
            if(this.waitNextWave>0){
              --this.waitNextWave;
            }else if(!_G.winner){
              this.doMoreTick(dt);
            }
          },
          doMoreTick(dt){
            this.bestCurScore=0;
            for(let b,i=0;i<this.ships.length;++i){
              b=this.ships[i];
              if(b.m5.dead){
                b.visible=false;
              }else{
                b.g.update(b.g.think(b.g.look()),dt);
                if(b.g.score>this.bestCurScore){
                  this.bestCurScore=b.g.score;
                }
              }
              if(_G.winner){
                break;
              }
            }
            this.isItEnd() ? this.resetNext() : 0;
          }
        });
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        _Z.run("StarfieldBg",{static:true});
        this.g.initTerrain();
        this.g.initLevel();
        this.g.genText=_S.bmpText("",UI_FONT,12*K);
        this.insert(this.g.genText);
      },
      dispose(){
      },
      postUpdate(dt){
        this.g.tick(dt);
        this.g.genText.text= `Generation: ${this.g.neatObj.curGen()} - Score: ${this.g.bestCurScore}`;
      }
    });

    _Z.run("Splash", SplashCfg);
  }

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  //load and run
  MojoH5Ldr({
    assetFiles: ["unmanned.png","click.mp3","fire.mp3",
                 "explosion.mp3","game_over.mp3","game_win.mp3"],
    arena: {width: 1344, height: 840},
    scaleToWindow:"max",
    //scaleFit:"x",
    start(...args){ scenes(...args) }
  });

})(this);


