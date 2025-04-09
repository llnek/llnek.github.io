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
  function scenes(Mojo){

    const int=Math.floor;
    const {Scenes:_Z,
           Sprites:_S,
           Input:_I,
           Ute2D:_U,
           FX:_F,
           v2:_V,
           math:_M,
           Game:_G,
           ute:_, is}=Mojo;

    const DQL= window["io/czlab/mcfud/algo/DQL"]();

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const
      UI_FONT= Mojo.DOKI_LOWER,
      SplashCfg= {
        title:"Bellman's Frozen Lake",
        titleSize: 72,
        action: {name:"PlayGame"},
        clickSnd:"click.mp3",
      };

    const ENV_MAP={
      T_4X4: [
        "SFFF",
        "FHFH",
        "FFFH",
        "HFFG"
        ],
      T_8X8: [
        "SFFFFFFF",
        "FFFFFFFF",
        "FFFHFFFF",
        "FFFFFHFF",
        "FFFHFFFF",
        "FHHFFFHF",
        "FHFFHFHF",
        "FFFHFFFG"
      ]
    };

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const doBackDrop=(s)=> s.insert(_S.fillMax("bg.jpg"));
    const playClick=()=> Mojo.sound("click.mp3").play();
    const CLICK_DELAY=343;
    const STEP_DELAY= 150;
    var MAP_SIZE=4;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /* */
    ////////////////////////////////////////////////////////////////////////////
    //_.inject(_G,{ });

    const DQLOpts={
      SECS_PER_EPISODE: 30,
      EPISODES: 250000,
      MAX_STEPS: 450,

      ALPHA: 0.8,
      GAMMA: 0.9,
      MAX_EPSILON: 1.0,
      MIN_EPSILON: 0.001,
      DECAY_RATE: 0.00005
    };

    const ACTIONS = ["L","R","U","D"];

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /* */
    ////////////////////////////////////////////////////////////////////////////
    /**
     * @class
     */
    class GameEnv extends DQL.Environment{
      #goalPos;
      #grid;
      #dim;
      #pos;
      constructor(options, N=4){
        super(options);
        _.assert(N==4 || N==8, "bad env size");
        this.#grid=[];
        this.#dim=N;
        ENV_MAP[`T_${N}X${N}`].forEach(r=> r.split("").forEach(c=> this.#grid.push(c)));
        _.assert(this.#grid.length==N*N, `bad grid size ${this.#grid.length}`);
        this.#goalPos = this.#grid.findIndex(c=> "G");
      }
      reset(){
        this.#pos= this.#grid.findIndex(c=> "S");
        return this.#pos;
      }
      actionSpace(){ return ACTIONS }
      #applyAction(action){
        let row= Math.floor(this.#pos / this.#dim);
        let col= this.#pos % this.#dim;
        let v, i=-1, reward=-100, done=0;
        switch(action){
          case "U":
            if(row==0){ reward= -1000; }else{
              i= (row-1)*this.#dim + col;
            }
            break;
          case "D":
            if(row== this.#dim-1){ reward= -1000; }else{
              i=(row+1)*this.#dim + col;
            }
            break;
          case "L":
            if(col== 0){ reward= -1000;}else{
              i=row * this.#dim + col-1;
            }
            break;
          case "R":
            if(col== this.#dim-1) { reward= -1000; }else{
              i= row * this.#dim + col+1;
            }
            break;
        }
        if(i>=0){
          v= this.#grid[i];
          this.#pos= i;
          if(v=="G"){
            reward= 999999;
            done=1;
          }else if(v=="H"){
            done=-999999;
          }else{
            reward = (Math.abs(this.#goalPos - this.#pos)<5) ? 300 : 30;
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
    /* */
    ////////////////////////////////////////////////////////////////////////////
    function mapToLevel(N){
      _.assert(N==4 || N==8, "bad map size");
      let g=[];
      ENV_MAP[`T_${N}X${N}`].forEach(r=> g.push(r.split("").map(c=> c)));
      _.assert(g.length==N && g[0].length==N, `bad grid size`);
      return g;
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    ////////////////////////////////////////////////////////////////////////////
    function moveAction(action, cs, ns){
      _G.items.find(s=>{
        if(s.g.value==ns){
          _G.player.x = s.x;
          _G.player.y= s.y;
          switch(action){
            case "L": _G.player.m5.showFrame(2); break;
            case "R": _G.player.m5.showFrame(3); break;
            case "U": _G.player.m5.showFrame(1);break;
            case "D": _G.player.m5.showFrame(0);break;
          }
          return true;
        }
      })
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /* */
    ////////////////////////////////////////////////////////////////////////////
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
          if(done > 0){
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
        _.inject(this.g,{
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
            if(MAP_SIZE==8){
              MAP_SIZE=4;
            }else{
              MAP_SIZE=8;
            }
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
            _G.winner=null;
            _G.player.m5.showFrame(0);
            if(!skip){
              _G.player.x = _G.playerOrigin[0];
              _G.player.y= _G.playerOrigin[1];
            }
          },
          initLevel(N){
            let level= mapToLevel(N),
              out={},
              h=level.length,
              w= level[0].length,
              grid=_S.gridXY([w,h],0.7,0.7,out);
            let c=grid[0][0],
              W=c.x2-c.x1, H=c.y2-c.y1;
            function cs(idx, y,x,type, [n,value]){
              let s=_S.sizeXY(_S.sprite(n),W,H);
              s.g.value=idx;
              s.g.row=y;
              s.g.col=x;
              _V.set(s,grid[y][x].x1,grid[y][x].y1);
              if(type=="S"){
                _G.player=_S.sizeXY(_S.spriteFrom("down.png","up.png",
                                                  "left.png","right.png"),W,H);
                _V.set(_G.player, s.x, s.y);
                _G.playerOrigin=[s.x,s.y];
                _G.player.g.value=idx;
                _G.player.g.row=y;
                _G.player.g.col=x;
              }
              return self.insert(s);
            }
            _G.items=[];
            for(let idx=0, s,r,x,y=0;y<level.length;++y)
            for(r=level[y], x=0; x<r.length; ++x){
              if(r[x]=="H"){
                s=_S.tint(cs(idx,y,x,r[x],["hole.png",idx]), "#61C5F4");
              }else if (r[x]=="G"){
                s=cs(idx,y,x,r[x],["goal.png",idx]);
              }else{
                s=cs(idx,y,x,r[x],["tile.png",idx]);
              }
              ++idx;
              _G.items.push(s);
            }
            self.insert(_G.player);
            let env= new GameEnv(DQLOpts,MAP_SIZE);
            let vars=env.getVars();
            let agent= new DQL.QLAgent(vars.ALPHA,vars.GAMMA,
              vars.MIN_EPSILON,vars.MAX_EPSILON,vars.DECAY_RATE, {
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
            this.resetNext(true);
          }
        });
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        doBackDrop(this)&&this.g.initLevel(MAP_SIZE);
        this.g.genText=_S.bmpText("",UI_FONT,20*K);
        this.insert(this.g.genText);
      },
      dispose(){
      },
      postUpdate(dt){
        this.g.tick(dt);
        this.g.genText.text= `Generation: ${_G.episodeCount+1} - Step: ${_G.curStep+1}`;
      }
    });
    _Z.run("Splash",SplashCfg);
  }

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  //load and run
  MojoH5Ldr({
    assetFiles: ["click.mp3","game_over.mp3","game_win.mp3",
                 "left.png","right.png","up.png","down.png",
                 "tile.png","hole.png","goal.png", "bg.jpg"],
    arena: {width:1344,height:840},
    scaleToWindow: "max",
    //scaleFit: "x",
    start(...args){ scenes(...args) }
  });

})(this);


