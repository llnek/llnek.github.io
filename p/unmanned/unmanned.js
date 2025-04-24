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
    const DQL= window["io/czlab/mcfud/algo/DQL"]();
    const Core= window["io/czlab/mcfud/core"]();

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
    const STEP_DELAY= 150;
    const OBJ_SHIP=1;
    const OBJ_HILL=2;
    const OBJ_GROUND=4;
    const OBJ_SITE=8;

    const BIG_NUMBER=9999999;
    const OUTOFBD= -1000000;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const ACTIONS = ["L","R","U","D","Z"];
    const DQLOpts={
      SECS_PER_EPISODE: 30,
      EPISODES: 250000,
      MAX_STEPS: 450,

      ALPHA: 0.8,
      GAMMA: 0.9,
      MAX_EPSILON: 0.002,//1.0,
      MIN_EPSILON: 0.001,
      DECAY_RATE: 0.00005
    };
    const COLS=20;
    const ROWS=12;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function initQT(qt,env){
      env.grid.forEach((g,i)=> {
        qt.set(i, g=new Map()); ACTIONS.forEach(a=> g.set(a, 0)); });
    }
    function genQT(qt,env){
      let row, col, m;
      initQT(qt,env);
      env.grid.forEach((g,s)=>{
        m=qt.get(s); row=int(s/COLS);col=s%COLS;
        m.set("D", 100);
        if(col < _G.goal[1]) m.set("R", 100);
        if(col > _G.goal[1]) m.set("L", 100);
        if(g == "H"){ m.set("D",-5000); m.set("U",5000); }
        if(g== "G"){
          m.set("Z",BIGNUMBER);
        }
      });
    }

    ////////////////////////////////////////////////////////////////////////////
    function _checkHit(t){ return _G.obstacles.find(o=> _S.hit(o,t)) }
    ////////////////////////////////////////////////////////////////////////////
    class GameEnv extends DQL.Environment{
      #goalPos;
      #grid;
      #dim;
      #pos;
      #gx;
      #gy;
      get grid(){ return this.#grid }
      constructor(COLS,ROWS, goal, options){
        super(options);
        this.#grid=_.fill(COLS*ROWS, ()=> ' ');
        this.#dim=COLS;
        let h=0, s=Ship(),pos= goal[0]*COLS + goal[1];
        this.#gy=goal[0];
        this.#gx=goal[1];
        this.#grid[0]="S";
        this.#grid[pos]= "G";
        for(let row,col,g,i=0; i< this.#grid.length; ++i){
          row=int(i/COLS);
          col=i%COLS;
          g=_G.grid[row][col];
          s.x=(g.x1+g.x2)/2;
          s.y=(g.y1+g.y2)/2;
          if(_checkHit(s)){
            this.#grid[i]="H";
            ++h;
          }
        }
        console.log(`Goal pos at row=${goal[0]},col=${goal[1]}, pos= ${pos}, holes=${h}`);
      }
      reset(){
        return this.#pos=0;
      }
      actionSpace(){ return ACTIONS }
      #applyAction(action){
        let row= int(this.#pos /COLS);
        let col= this.#pos % COLS;
        let nr=row,nc=col,v, i=-1, reward=-100, done=0;
        const OUTOFBD= -10000;
        switch(action){
          case "U":
            nr=row-1;
            if(row==0){ reward= OUTOFBD; }else{
              i= nr*this.#dim + col;
            }
            break;
          case "D":
            nr=row+1;
            if(row== this.#dim-1){ reward= OUTOFBD; }else{
              i=nr*this.#dim + col;
            }
            break;
          case "L":
            nc=col-1;
            if(col== 0){ reward= OUTOFBD;}else{
              i=row * this.#dim + nc;
            }
            break;
          case "R":
            nc=col+1;
            if(col== this.#dim-1) { reward= OUTOFBD; }else{
              i= row * this.#dim + nc;
            }
            break;
          case "Z":
            break;
        }
        if(i<0){
          reward=OUTOFBD;
          done=-1;
        }
        if(i>=0){
          v= this.#grid[i];
          this.#pos= i;
          if(v=="G"){
            reward= 999999;
            done=1;
          }else{
            let g= _G.grid[nr][nc];
            let ox=_G.player.x;
            let oy=_G.player.y;
            _G.player.x= (g.x1+g.x2)/2;
            _G.player.y= (g.y1+g.y2)/2;
            if(_checkHit(_G.player)){
              reward= -9999999;
              done=-1;
            }else{
              reward = 100 * Mojo.height/(1+Math.abs(_G.target.y - _G.player.y)) +
                       5000 * Mojo.width/(1+Math.abs(_G.target.x - _G.player.x));
            }
            _G.player.x=ox;
            _G.player.y=oy;
          }
        }
        return [reward, done];
      }
      getState(){
        return this.#pos;
      }
      step(action){
        const rc = this.#applyAction(action);
        rc.unshift(this.#pos);
        //[new_state, reward, done?]
        return rc;
      }
    }

    ////////////////////////////////////////////////////////////////////////////
    function Ship(){
      let gz=_G.grid[0][0];
      let w= _S.sprite("unmanned.png").height,
          s=_S.sprite(_S.frames("unmanned.png",w,w));
      s.width=gz.x2-gz.x1;
      s.height=gz.y2-gz.y1;
      _S.centerAnchor(s);
      s.m5.type=OBJ_SHIP;
      s.m5.cmask=OBJ_HILL | OBJ_GROUND | OBJ_SITE;
      s.x= _G.arena.x + (gz.x2-gz.x1)/2;
      s.y= _G.arena.y + (gz.y2-gz.y1)/2;
      s.g.value=0;
      s.g.row=0;
      s.g.col=0;
      _G.playerOrigin=[s.x,s.y];
      return _G.player=s;
    }

    ////////////////////////////////////////////////////////////////////////////
    function moveAction(action, cs, ns){
      let row=int(ns/COLS);
      let col=ns%COLS;
      let g= _G.grid[row][col];
      _.assert(g, "bad row col index in moveAction");
      let tx= (g.x1+g.x2)/2;
      let ty= (g.y1+g.y2)/2;
      switch(action){
        case "L": break;
        case "R": break;
        case "U": break;
          _G.player.m5.showFrame(1); break;
        case "D": break;
        case "Z": break;
      }
      if(_checkHit(_G.player)){
        _G.player.m5.dead=true;
      }else{
        let z=_F.tweenXY(_G.player,_F.SMOOTH, tx, ty,30);
        z.onComplete=()=>{
          _G.player.m5.showFrame(0);
        }
      }
      return true;
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    _Z.scene("PlayGame",{
      setup(){
        const self=this, K=Mojo.getScaleFactor();
        function workFunc(){
          let ns, reward, action, cs=_G.cs, done=0;
          if(_G.winner){
            return self.g.postEpisode(_G.winner);
          }
          if(_G.curStep < _G.maxSteps){
            action= _G.agent.getAction(cs, _G.env.actionSpace());
            console.log(`Got new action === ${action}`);
            [ns, reward, done]= _G.env.step(action);
            _G.agent.updateQValue(cs, action, ns, reward);
            _G.mem.push([cs,action,ns, reward]);
            _G.cs=ns;
            _G.curStep += 1;
            if(cs != ns){
              moveAction(action, cs, ns);
            }
          }
          if(_G.player.m5.dead){
            _G.winner="loser";
          }else if(done > 0){
            _G.winner= "winner";
          }else if(done<0){
            _G.winner="loser";
          }else if(_G.curStep>=_G.maxSteps){
            _G.winner= "timed-out";
          }
          if(_G.winner){
            //ended one episode
            self.future(workFunc, STEP_DELAY*1.5);
          }else{
            self.future(workFunc, STEP_DELAY);
          }
        }
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        _.inject(this.g,{
          initTerrain(){ Terrain(self,K,[]) },
          initLevel(){
            let out={}, grid=_S.gridXY([COLS,ROWS],0.9,0.9,out);
            let gfx=_S.graphics();
            _G.grid=grid;
            _G.arena=out;
            //_S.drawGridBox(out,1,"white",gfx);
            _S.drawGridLines(0,0,grid,1,{color:"white",alpha:0},gfx);
            self.insert(gfx);
            this.waitNextWave=0;
            grid.find((r,i)=> r.find((c,j)=>{
              if(_G.target.x>= c.x1 && _G.target.x<= c.x2 &&
                _G.target.y>= c.y1 && _G.target.y<= c.y2){
                _G.goal=[i,j];
                return true;
              }
            }));
            let env= new GameEnv(COLS,ROWS,_G.goal, DQLOpts);
            let vars=env.getVars();
            let agent= new DQL.QLAgent(vars.ALPHA,vars.GAMMA, vars.MIN_EPSILON,vars.MAX_EPSILON,vars.DECAY_RATE, {
              qtableCtor:function(qt){
                genQT(qt,env)
              },
              randActionFunc:function(arr){
                let pos;
                if(_.rand()< 0.5){
                  pos= _.rand() < 0.5 ? 0 : 3
                }else{
                  pos= _.rand() < 0.5 ? 1 : 2
                }
                return ACTIONS[pos];
              }
            });
            _G.totalEpisodes= vars.EPISODES;
            _G.maxSteps= vars.MAX_STEPS;
            _G.agent= agent;
            _G.env= env;
            _G.curStep=0;
            _G.episodeCount=0;
            self.insert(Ship());
          },
          tick(dt){
            if(this.waitNextWave>0){
              --this.waitNextWave;
              if(this.waitNextWave==0){
                //do this once each episode
                _G.cs= _G.env.reset();
                _G.winner=null;
                _G.curStep=0;
                _G.mem=[];
                self.future(workFunc, STEP_DELAY);
              }
            }
          },
          onNewGame(){
            _.delay(CLICK_DELAY,()=>  _Z.run("PlayGame"));
          },
          postEpisode(reason){
            if(reason=="winner"){
              console.log(`Success!!!! @episode ${_G.episodeCount}`);
              console.log(_G.agent.prnQTable());
              return this.onNewGame();
            }
            //console.log(_G.mem.reduce((acc,m)=> acc + `[${m[0]}, ${m[1]}, ${m[2]}, ${m[3]}]`, ""));
            console.log(`Failed!!!! @episode ${_G.episodeCount}`);
            _G.agent.decayEpsilon(_G.episodeCount);
            if(++_G.episodeCount < _G.totalEpisodes){
              this.resetNext();
            }else{
              console.log(`Ran out of episodes ${_G.episodeCount}`);
              this.onNewGame();
            }
          },
          resetNext(skip){
            this.waitNextWave=30;
            _G.player.m5.dead=false;
            _G.winner=null;
            //_G.player.m5.showFrame(0);
            if(!skip){
              _//G.player=Ship();
              _G.player.x = _G.playerOrigin[0];
              _G.player.y= _G.playerOrigin[1];
            }
          }
        });

        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        _Z.run("StarfieldBg",{static:true});
        this.g.initTerrain();
        this.g.initLevel();
        this.g.resetNext(true);
        this.insert(this.g.genText=_S.bmpText("",UI_FONT,12*K));
      },
      dispose(){
      },
      postUpdate(dt){
        this.g.tick(dt);
        this.g.genText.text= `Generation: ${_G.episodeCount+1} - Step: ${_G.curStep+1}`;
      }
    });

    ////////////////////////////////////////////////////////////////////////////
    function Terrain(self,K,out){
      let maxH=int(Mojo.height*0.4);
      let minH= int(maxH*0.25);
      let hoffset=10*K;
      let s,pad=6,N=10;
      let w=Mojo.width/N;
      let vcolor=_S.color("#906908");
      let pcolor=_S.color("#cbcb02");
      let T=[0.1,0.24,0.24,0.24,0.24,0.24,0.25,0.25,0.25,0.25];
      let V=[0,0,0.2,0.5,0,0.3,0.0,1.2,1.2,0];
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


